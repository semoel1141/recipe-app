const { GoogleGenAI, Modality } = require('@google/genai');

// מודל ברירת המחדל - flash הוא המהיר והזול, מספיק לחלוטין ליצירת מתכונים.
// הערה: גרסאות ישנות יותר (למשל gemini-2.5-flash) כבר לא זמינות למפתחות API חדשים
// ומחזירות 404. אם מקבלים "no longer available to new users" - צריך לעדכן את השם כאן.
// אפשר לראות את המודלים הזמינים למפתח שלכם עם ai.models.list().
const MODEL = 'gemini-3.6-flash';

// מודל ליצירת תמונות. שימו לב: יצירת תמונות **אינה כלולה ב-tier החינמי** של Gemini -
// בלי חיוב מופעל בפרויקט, כל קריאה תיכשל ב-429 עם quotaId שמסתיים ב-"FreeTier".
const IMAGE_MODEL = 'gemini-3.1-flash-image';

// ה-schema שה-AI *חייב* להחזיר. Gemini תומך ב-responseSchema ברמת ה-API,
// כלומר המבנה נאכף על ידי הספק עצמו ולא רק מבוקש בטקסט הפרומפט - זה מבטל
// את הצורך ב"ניקוי" של ```json מסביב לתשובה ומונע שדות חסרים/מיותרים.
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'שם המתכון בעברית' },
    description: { type: 'string', description: 'תיאור קצר ומפתה של המנה, משפט או שניים' },
    ingredients: {
      type: 'array',
      description: 'רשימת מרכיבים, כל פריט כולל כמות (למשל "2 כוסות קמח")',
      items: { type: 'string' },
    },
    instructions: {
      type: 'array',
      description: 'שלבי ההכנה לפי הסדר, כל שלב כמשפט או שניים',
      items: { type: 'string' },
    },
    prepTime: { type: 'integer', description: 'זמן הכנה כולל בדקות' },
    servings: { type: 'integer', description: 'מספר מנות' },
  },
  required: ['title', 'description', 'ingredients', 'instructions', 'prepTime', 'servings'],
  propertyOrdering: ['title', 'description', 'ingredients', 'instructions', 'prepTime', 'servings'],
};

let client = null;

// יוצרים את הלקוח בפעם הראשונה שצריך אותו (ולא בזמן טעינת הקובץ),
// כדי שהשרת יעלה גם בלי מפתח - רק ה-routes של ה-AI ייכשלו עם הודעה ברורה
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('חסר GEMINI_API_KEY בקובץ .env - יש להשיג מפתח ב-https://aistudio.google.com/apikey');
    error.statusCode = 503;
    throw error;
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * שולח פרומפט ל-Gemini ומחזיר אובייקט מתכון מפורסר לפי RECIPE_SCHEMA.
 * @param {string} prompt - ההנחיה המלאה למודל
 * @returns {Promise<object>} אובייקט המתכון
 */
async function generateRecipeJson(prompt) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'אתה שף מקצועי שכותב מתכונים בעברית. החזר תמיד מתכון מלא, מעשי וניתן לביצוע, ' +
        'עם כמויות מדויקות והוראות ברורות. כתוב בעברית תקנית בלבד.',
      responseMimeType: 'application/json',
      responseSchema: RECIPE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    const error = new Error('ה-AI החזיר תשובה ריקה');
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    // בפועל לא אמור לקרות בזכות responseSchema, אבל עדיף להיכשל בהודעה ברורה מאשר לקרוס
    const error = new Error('ה-AI החזיר תשובה שאינה JSON תקין');
    error.statusCode = 502;
    throw error;
  }
}

/**
 * מבקש מה-AI לייצר תמונת מזון של המנה.
 * @param {string} title - שם המתכון
 * @param {string} description - תיאור קצר (עוזר למודל לדייק)
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
async function generateRecipeImage(title, description = '') {
  const ai = getClient();

  const prompt =
    `Professional food photography of "${title}".` +
    (description ? ` ${description}.` : '') +
    ' Overhead shot on a rustic table, natural window light, shallow depth of field, ' +
    'appetizing and freshly plated, high resolution, no text or watermarks.';

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { responseModalities: [Modality.IMAGE] },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    const error = new Error('ה-AI לא החזיר תמונה');
    error.statusCode = 502;
    throw error;
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

/**
 * מבקש מה-AI מונח חיפוש קצר באנגלית שמתאר את המנה.
 * משמש למסלול הגיבוי - שליפת תצלום אמיתי מ-TheMealDB כשיצירת תמונה לא זמינה.
 * @param {string} title
 * @returns {Promise<string>}
 */
async function suggestImageSearchTerm(title) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      `שם המנה: "${title}". החזר מונח חיפוש קצר באנגלית (1-3 מילים) ` +
      'שמתאר את סוג המנה ויתאים לחיפוש תצלום שלה. החזר את המונח בלבד, בלי הסבר.',
  });

  return (response.text || '').trim().replace(/[."']/g, '').slice(0, 40);
}

module.exports = {
  generateRecipeJson,
  generateRecipeImage,
  suggestImageSearchTerm,
  RECIPE_SCHEMA,
  MODEL,
  IMAGE_MODEL,
};
