const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');
const { aiTextLimiter, aiImageLimiter } = require('../middleware/rateLimit');
const {
  generateRecipeJson,
  generateRecipeImage,
  suggestImageSearchTerm,
} = require('../config/gemini');
const { getCuratedImage, deriveSearchTerms } = require('../config/recipeImages');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// עוטף handler אסינכרוני ומעביר שגיאות ל-handler המרכזי בתחתית הקובץ,
// כדי לא לחזור על אותו try/catch בכל route
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ולידציה בסיסית של אובייקט מתכון שהגיע מהלקוח (ב-/modify וב-/save),
// כי אסור לסמוך על כך שהלקוח שולח בדיוק את מה שה-AI החזיר
function validateRecipeShape(recipe) {
  if (!recipe || typeof recipe !== 'object') return 'חסר אובייקט מתכון';
  if (!recipe.title?.trim()) return 'למתכון חסר שם';
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return 'למתכון חסרים מרכיבים';
  const hasInstructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.length > 0
    : Boolean(recipe.instructions?.trim());
  if (!hasInstructions) return 'למתכון חסרות הוראות הכנה';
  return null;
}

// POST /api/recipes/generate - יוצר מתכון חדש מאפס לפי בקשה חופשית של המשתמש
router.post(
  '/generate',
  aiTextLimiter,
  asyncHandler(async (req, res) => {
    const { prompt } = req.body;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'יש לכתוב מה להכין' });
    }
    if (prompt.length > 500) {
      return res.status(400).json({ message: 'הבקשה ארוכה מדי (עד 500 תווים)' });
    }

    const recipe = await generateRecipeJson(
      `צור מתכון מלא לפי הבקשה הבאה של המשתמש:\n\n"${prompt.trim()}"\n\n` +
        'אם הבקשה כוללת אילוצים (טבעוני, ללא גלוטן, זמן קצר וכדומה) - עמוד בהם בקפדנות.'
    );

    res.json(recipe);
  })
);

// POST /api/recipes/modify - מקבל מתכון קיים + בקשת שינוי, ומחזיר גרסה מעודכנת
router.post(
  '/modify',
  aiTextLimiter,
  asyncHandler(async (req, res) => {
    const { recipe, request } = req.body;

    const shapeError = validateRecipeShape(recipe);
    if (shapeError) {
      return res.status(400).json({ message: shapeError });
    }
    if (typeof request !== 'string' || !request.trim()) {
      return res.status(400).json({ message: 'יש לכתוב מה לשנות במתכון' });
    }
    if (request.length > 500) {
      return res.status(400).json({ message: 'בקשת השינוי ארוכה מדי (עד 500 תווים)' });
    }

    // שולחים רק את השדות הרלוונטיים ולא את כל האובייקט מהלקוח (בלי _id, owner וכו')
    const currentRecipe = {
      title: recipe.title,
      description: recipe.description || '',
      ingredients: recipe.ingredients,
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions
        : String(recipe.instructions).split('\n').filter(Boolean),
      prepTime: recipe.prepTime ?? 0,
      servings: recipe.servings ?? 1,
    };

    const updated = await generateRecipeJson(
      'להלן מתכון קיים בפורמט JSON:\n\n' +
        `${JSON.stringify(currentRecipe, null, 2)}\n\n` +
        `בצע בו את השינוי הבא: "${request.trim()}"\n\n` +
        'החזר את המתכון המלא לאחר השינוי - כולל כל השדות, גם אלה שלא השתנו. ' +
        'עדכן גם את הכמויות, זמן ההכנה והתיאור אם השינוי מחייב זאת.'
    );

    res.json(updated);
  })
);

// מחפש תצלום אמיתי של המנה ב-TheMealDB (API ציבורי חינמי, בלי מפתח).
// זהו מסלול הגיבוי כשיצירת תמונה ב-AI לא זמינה (אין חיוב מופעל בפרויקט).
async function findStockPhoto(searchTerm) {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.meals?.[0]?.strMealThumb || null;
}

/**
 * מנסה למצוא תצלום שמתאים לשם המתכון, לפי סדר עדיפויות יורד של דיוק.
 *
 * הבאג שתוקן כאן: קודם, גזירת מונח החיפוש הסתמכה **רק** על קריאה ל-Gemini.
 * בפרודקשן אין GEMINI_API_KEY, ולכן suggestImageSearchTerm זרק שגיאה, כל
 * ה-try נכשל, והקוד נפל ל-findStockPhoto('food') - שמחזיר תמיד את אותה
 * תמונה גנרית ראשונה. כך כל מתכוני ה-AI קיבלו תמונה זהה ולא קשורה.
 *
 * עכשיו יש שלוש שכבות, וכולן חוץ מהראשונה עובדות גם בלי מפתח AI.
 *
 * @param {string} title שם המתכון
 * @returns {Promise<{imageUrl: string, source: string}|null>}
 */
async function findMatchingPhoto(title) {
  // 1. התאמה מדויקת מהמפה הקבועה (המתכונים המקוריים של האתר)
  const curated = getCuratedImage(title);
  if (curated) return { imageUrl: curated, source: 'curated' };

  // 2. מונחי חיפוש שנגזרים מהכותרת בעברית - בלי תלות ב-AI.
  //    מנסים מהספציפי לרחב, כי הקטלוג של TheMealDB מוגבל.
  for (const term of deriveSearchTerms(title)) {
    const photo = await findStockPhoto(term);
    if (photo) return { imageUrl: photo, source: 'stock' };
  }

  // 3. מונח שה-AI מציע - רק אם יש מפתח. עוטף ב-try כי חוסר מפתח זורק 503,
  //    וכישלון כאן לא אמור להפיל את כל הבקשה.
  try {
    const suggested = await suggestImageSearchTerm(title);
    if (suggested) {
      const photo = await findStockPhoto(suggested);
      if (photo) return { imageUrl: photo, source: 'stock-ai' };
    }
  } catch {
    // אין מפתח AI, או שהקריאה נכשלה - ממשיכים בלי
  }

  // במכוון **לא** נופלים לחיפוש גנרי כמו 'food': תמונה שרירותית שלא קשורה
  // למנה גרועה יותר מהיעדר תמונה. הלקוח מציג פלייסהולדר נקי במקרה כזה.
  return null;
}

// POST /api/recipes/generate-image - מייצר תמונה למתכון.
// קודם מנסה ליצור תמונה אמיתית ב-AI; אם זה לא זמין (מכסה/חיוב) - נופל לתצלום אמיתי מ-TheMealDB,
// כדי שלמתכון תמיד תהיה תמונה ולא ייתקע בלי כלום.
router.post(
  '/generate-image',
  aiImageLimiter,
  asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'חסר שם מתכון ליצירת התמונה' });
    }

    // מסלול ראשי: יצירת תמונה ב-AI
    try {
      const { buffer, mimeType } = await generateRecipeImage(title, description);

      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
      const fileName = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(path.join(UPLOADS_DIR, fileName), buffer);

      // מחזירים נתיב **יחסי** ולא כתובת מלאה (C4): כתובת מלאה עם localhost
      // נשמרת במסד ונשברת ברגע שהשרת עובר לדומיין אמיתי. הלקוח מרכיב את
      // הכתובת המלאה מול ה-API שהוא מדבר איתו בפועל.
      return res.json({ imageUrl: `/uploads/${fileName}`, source: 'ai' });
    } catch (aiError) {
      console.warn('[generate-image] יצירת תמונה ב-AI נכשלה, עובר לגיבוי:', aiError.message.slice(0, 120));
    }

    // מסלול גיבוי: תצלום אמיתי שמתאים לשם המנה (ראו findMatchingPhoto)
    try {
      const match = await findMatchingPhoto(title);
      if (match) {
        return res.json(match);
      }
    } catch (fallbackError) {
      console.warn('[generate-image] גם הגיבוי נכשל:', fallbackError.message.slice(0, 120));
    }

    res.status(502).json({ message: 'לא הצלחנו להשיג תמונה שמתאימה למתכון' });
  })
);

// POST /api/recipes/save - שומר את המתכון הסופי ב-DB (רק למשתמש מחובר)
router.post(
  '/save',
  protect,
  asyncHandler(async (req, res) => {
    const { recipe } = req.body;

    const shapeError = validateRecipeShape(recipe);
    if (shapeError) {
      return res.status(400).json({ message: shapeError });
    }

    // ה-AI מחזיר instructions כמערך שלבים; במסד הוא נשמר כמחרוזת עם \n בין השלבים
    const instructions = Array.isArray(recipe.instructions)
      ? recipe.instructions.join('\n')
      : recipe.instructions;

    // הבעלים נלקח מהטוקן ולא מגוף הבקשה, בדיוק כמו ביצירת מתכון רגילה
    const saved = await Recipe.create({
      title: recipe.title,
      description: recipe.description || '',
      ingredients: recipe.ingredients,
      instructions,
      prepTime: Number(recipe.prepTime) || 0,
      servings: Number(recipe.servings) || 1,
      imageUrl: recipe.imageUrl || '',
      aiGenerated: true,
      owner: req.user._id,
    });

    res.status(201).json(saved);
  })
);

// handler מרכזי לשגיאות של ה-routes בקובץ הזה
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  // statusCode מגיע משגיאות שאנחנו זורקים ב-config/gemini.js (חוסר מפתח, תשובה לא תקינה)
  const status = err.statusCode || 500;
  const message =
    status === 500 ? 'שגיאה בשירות ה-AI, נסו שוב בעוד רגע' : err.message;

  console.error('[AI route error]', err.message);
  res.status(status).json({ message });
});

module.exports = router;
