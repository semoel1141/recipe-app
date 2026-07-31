/**
 * מקור אמת יחיד לתמונות מתכונים.
 *
 * ---------------------------------------------------------------------------
 * הרקע: למה הקובץ הזה נוצר
 * ---------------------------------------------------------------------------
 * המתכונים המקוריים נזרעו עם כתובות של loremflickr.com, למשל:
 *     https://loremflickr.com/500/350/shakshuka,food/all
 *
 * זהו שירות **תמונות אקראיות**, לא ספריית תמונות. אותה כתובת בדיוק מחזירה
 * צילום אחר בכל בקשה (נבדק: 3 בקשות רצופות = 3 תמונות שונות), והבחירה
 * מתבססת על תגיות משתמשים ב-Flickr שאינן אמינות. התוצאה הייתה תמונות
 * שגם משתנות בכל רענון וגם לרוב לא מציגות את המנה הנכונה.
 *
 * הפתרון: כתובות **קבועות** לתמונה ספציפית ומאומתת של כל מנה.
 * רוב התמונות הן התמונה הראשית של ערך הוויקיפדיה של אותה מנה - כלומר
 * צילום שזוהה ותויג על ידי עורכים אנושיים כמנה הזו בדיוק.
 */

/**
 * מפה קבועה: שם מתכון -> כתובת תמונה מאומתת.
 * כל הכתובות נבדקו ומחזירות content-type של image/*.
 */
const CURATED_IMAGES = {
  'חומוס ביתי':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Lebanese_style_hummus.jpg/500px-Lebanese_style_hummus.jpg',
  שקשוקה:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Shakshuka_by_Calliopejen1.jpg/500px-Shakshuka_by_Calliopejen1.jpg',
  'סלט ישראלי': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Salad.jpg/500px-Salad.jpg',
  'מרק עדשים כתומות':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/EgFoodLentilSoup.jpg/500px-EgFoodLentilSoup.jpg',
  'שניצל עוף פריך':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Breitenlesau_Krug_Br%C3%A4u_Schnitzel.JPG/500px-Breitenlesau_Krug_Br%C3%A4u_Schnitzel.JPG',
  'פסטה ברוטב עגבניות וריחן':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Spaghettata.JPG/500px-Spaghettata.JPG',
  'עוגת שוקולד פשוטה':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Chocolate_fudge_cake.jpg/500px-Chocolate_fudge_cake.jpg',
  פלאפל: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Falafels_2.jpg/500px-Falafels_2.jpg',
  'עוף בתנור עם תפוחי אדמה':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Max%27s_Roasted_Chicken_-_Evan_Swigart.jpg/500px-Max%27s_Roasted_Chicken_-_Evan_Swigart.jpg',
  'סלט טונה עם תירס':
    'https://www.themealdb.com/images/media/meals/yypwwq1511304979.jpg',
  'בורקס תפוחי אדמה':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Meat_burek_%28GAK_bakery%2C_Belgrade%2C_Serbia%29.jpg/500px-Meat_burek_%28GAK_bakery%2C_Belgrade%2C_Serbia%29.jpg',
  'חביתה עם ירקות':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Gorgonzola_%2B_Bacon_Omelette_%40_Omelegg_%40_Amsterdam_%2816600947041%29.jpg/500px-Gorgonzola_%2B_Bacon_Omelette_%40_Omelegg_%40_Amsterdam_%2816600947041%29.jpg',
  פנקייקים:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg/500px-Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg',
  'מרק ירקות חורפי':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Minestrone_soup_%285%29.jpg/500px-Minestrone_soup_%285%29.jpg',
  סביח: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Sabich1.png/500px-Sabich1.png',
  'קוסקוס עם ירקות':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Moroccan_cuscus%2C_from_Casablanca%2C_September_2018.jpg/500px-Moroccan_cuscus%2C_from_Casablanca%2C_September_2018.jpg',
  'עוגיות שוקולד צ׳יפס':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Choco_chip_cookie.png/500px-Choco_chip_cookie.png',
};

/**
 * מילון מונחי חיפוש: מילת מפתח בעברית -> מונח חיפוש באנגלית ב-TheMealDB.
 *
 * למה זה נחוץ: מתכון שנוצר ב-AI מקבל שם חופשי ("פסטה ברוטב שמנת ופטריות
 * מהירה") שלא נמצא ב-CURATED_IMAGES. קודם, גזירת מונח החיפוש הסתמכה על
 * קריאה ל-Gemini - וכשאין GEMINI_API_KEY (כמו בפרודקשן), כל השרשרת נכשלה
 * ונפלה ל-findStockPhoto('food'), שמחזיר תמיד את **אותה** תמונה גנרית.
 * זו הסיבה שכל מתכוני ה-AI קיבלו תמונה זהה שלא קשורה לתוכן.
 *
 * המילון הזה מאפשר לגזור מונח רלוונטי מהכותרת בעברית בלי שום תלות ב-AI.
 *
 * מבנה כל רשומה: [מילת מפתח בעברית, מונח ספציפי, מונח רחב (אופציונלי)].
 * המונח הרחב נחוץ כי הקטלוג של TheMealDB מוגבל - למשל "chocolate mousse"
 * מחזיר 0 תוצאות בעוד "chocolate" מחזיר 16. בלי שרשרת הנפילה, מתכונים
 * לגיטימיים היו נשארים בלי תמונה.
 *
 * הסדר חשוב: ביטויים ספציפיים לפני כלליים ("עוגת גבינה" לפני "עוגה").
 *
 * אזהרה למי שמוסיף מונח רחב: **חייבים לבדוק שהוא מחזיר תוצאות בפועל.**
 * 'dessert' נראה כמו מונח רחב סביר, אבל search.php מחזיר עליו 0 תוצאות -
 * הוא שם של קטגוריה ולא של מנה. הוא שימש כאן כגיבוי לוופל/קרפ/גלידה/
 * טירמיסו, וכך כל המתכונים האלה נשארו בלי תמונה בכלל. הגיבוי הרחב באמת
 * הוא CATEGORY_KEYWORDS למטה, שמשתמש ב-filter.php ולא ב-search.php.
 */
const KEYWORD_TERMS = [
  // מאפים וקינוחים - לפני "עוגה" הכללי
  ['עוגת גבינה', 'cheesecake'],
  ['עוגת שוקולד', 'chocolate cake', 'chocolate'],
  ['מוס שוקולד', 'chocolate mousse', 'chocolate'],
  ['עוגיות', 'cookies'],
  ['בראוני', 'brownies', 'chocolate'],
  ['פנקייק', 'pancakes'],
  ['וופל', 'waffles'],
  ['קרפ', 'crepe'],
  ['עוגה', 'cake'],
  ['טירמיסו', 'tiramisu'],
  ['גלידה', 'ice cream'],
  ['שוקולד', 'chocolate'],

  // מנות עיקריות
  ['שקשוקה', 'shakshuka'],
  ['חומוס', 'hummus'],
  ['פלאפל', 'falafel'],
  ['סביח', 'sabich'],
  ['שניצל', 'schnitzel'],
  ['המבורגר', 'burger'],
  ['פיצה', 'pizza'],
  ['לזניה', 'lasagna'],
  ['ריזוטו', 'risotto'],
  ['פסטה', 'pasta'],
  ['ספגטי', 'spaghetti'],
  ['נודלס', 'noodles'],
  ['אורז', 'rice'],
  ['קוסקוס', 'couscous'],
  ['בורקס', 'borek'],
  ['קארי', 'curry'],
  ['טאקו', 'tacos'],
  ['סושי', 'sushi'],

  // חלבונים
  ['עוף', 'chicken'],
  ['בקר', 'beef'],
  ['בשר', 'beef'],
  ['דג', 'fish'],
  ['סלמון', 'salmon'],
  ['טונה', 'tuna'],
  ['שרימפס', 'shrimp'],
  ['ביצים', 'eggs'],
  ['חביתה', 'omelette'],
  ['טופו', 'tofu'],
  ['עדשים', 'lentils'],

  // סוגי מנה
  ['מרק', 'soup'],
  ['סלט', 'salad'],
  ['תבשיל', 'stew'],
  ['קדרה', 'casserole'],
  ['כריך', 'sandwich'],

  // מאפים ולחמים. הקטלוג של TheMealDB לא מכיר את רובם בשמם ('focaccia',
  // 'quiche' ו-'pastry' מחזירים 0 תוצאות), ולכן לכולם יש מונח רחב שנבדק
  // ומחזיר תוצאות בפועל: 'bread' (25) או 'tart' (13).
  // 'קישוא' חייב להופיע לפני 'קיש', אחרת "פשטידת קישואים" הייתה מזוהה כקיש.
  ['פוקאצ', 'focaccia', 'bread'],
  ['ציאבטה', 'ciabatta', 'bread'],
  ['בגט', 'baguette', 'bread'],
  ['לחמני', 'rolls', 'bread'],
  ['פיתה', 'pita', 'bread'],
  ['חלה', 'challah', 'bread'],
  ['מאפה', 'pastry', 'bread'],
  ['קישוא', 'courgette', 'vegetarian'],
  ['קיש', 'quiche', 'tart'],
  ['טארט', 'tart'],
  ['לחם', 'bread'],

  ['פשטידה', 'pie'],

  // ירקות
  ['חציל', 'eggplant'],
  ['פטריות', 'mushroom'],
  ['תפוחי אדמה', 'potato'],
  ['בטטה', 'sweet potato'],
  ['ברוקולי', 'broccoli'],
  ['דלעת', 'pumpkin'],
];

/**
 * מילת מפתח בעברית -> קטגוריה של TheMealDB.
 *
 * זהו הגיבוי הרחב האמיתי, והוא משתמש ב-filter.php?c= ולא ב-search.php.
 * ההבדל מהותי: search.php?s=dessert מחזיר 0 תוצאות, בעוד
 * filter.php?c=Dessert מחזיר 167 מנות. ארבע-עשרה הקטגוריות הקיימות הן
 * Beef, Breakfast, Chicken, Dessert, Goat, Lamb, Miscellaneous, Pasta,
 * Pork, Seafood, Side, Starter, Vegan, Vegetarian.
 *
 * הסדר חשוב כמו למעלה - הספציפי לפני הכללי.
 */
const CATEGORY_KEYWORDS = [
  ['עוגת גבינה', 'Dessert'],
  ['עוגה', 'Dessert'],
  ['עוגיות', 'Dessert'],
  ['קינוח', 'Dessert'],
  ['מוס', 'Dessert'],
  ['בראוני', 'Dessert'],
  ['וופל', 'Dessert'],
  ['קרפ', 'Dessert'],
  ['פנקייק', 'Dessert'],
  ['טירמיסו', 'Dessert'],
  ['גלידה', 'Dessert'],
  ['שוקולד', 'Dessert'],

  ['עוף', 'Chicken'],
  ['בקר', 'Beef'],
  ['בשר', 'Beef'],

  ['סלמון', 'Seafood'],
  ['טונה', 'Seafood'],
  ['שרימפס', 'Seafood'],
  ['דג', 'Seafood'],

  ['לזניה', 'Pasta'],
  ['ספגטי', 'Pasta'],
  ['פסטה', 'Pasta'],

  ['חביתה', 'Breakfast'],
  ['ביצים', 'Breakfast'],

  ['טופו', 'Vegetarian'],
  ['קישוא', 'Vegetarian'],
  ['סלט', 'Vegetarian'],
  ['ירקות', 'Vegetarian'],

  // מאפים ולחמים - אין קטגוריית Bread ב-TheMealDB, ו-Side היא הקרובה ביותר
  ['פוקאצ', 'Side'],
  ['ציאבטה', 'Side'],
  ['בגט', 'Side'],
  ['לחמני', 'Side'],
  ['פיתה', 'Side'],
  ['חלה', 'Side'],
  ['מאפה', 'Side'],
  ['לחם', 'Side'],
];

/**
 * בודק אם שם המתכון מכיל מילת מפתח, כולל הנטיות הנפוצות שלה.
 *
 * שם עצם נקבי בעברית שמסתיים ב-ה' מופיע בכותרות מתכונים בשלוש צורות:
 *   רגילה  - "גלידה ביתית"
 *   סמיכות - "גלידת וניל"    (ה' -> ת')
 *   רבים   - "פיתות ביתיות"  (ה' -> ות')
 *
 * התאמת includes פשוטה תופסת רק את הראשונה, ולכן מתכונים לגיטימיים נשארו
 * בלי תמונה בכלל: "גלידת וניל" לא התאים ל'גלידה', "פיתות ביתיות" לא התאים
 * ל'פיתה'. שלוש השורות כאן מכסות את רובן המכריע של הכותרות בפועל.
 *
 * @param {string} title שם המתכון (כבר trimmed)
 * @param {string} keyword מילת המפתח מהמילון
 */
function matchesKeyword(title, keyword) {
  if (title.includes(keyword)) return true;

  // הנטיות רלוונטיות רק למילים שמסתיימות ב-ה'
  if (!keyword.endsWith('ה')) return false;

  const stem = keyword.slice(0, -1);
  return title.includes(`${stem}ת`) || title.includes(`${stem}ות`);
}

/**
 * גיבוב יציב של מחרוזת (וריאנט של djb2).
 *
 * חייב להיות דטרמיניסטי בין הרצות ובין גרסאות Node - ולכן חשבון פשוט
 * ולא Math.random ולא crypto. זו הדרישה שמאפשרת לאותו מתכון לקבל תמיד
 * את אותה תמונה, גם אחרי פריסה מחדש של השרת.
 */
function stableHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    // |0 שומר על 32 ביט ומונע גלישה למספרים לא מדויקים
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * מצמצם תוצאות חיפוש לאלה שבהן מונח החיפוש מופיע כמילה שלמה.
 *
 * החיפוש של TheMealDB הוא תת-מחרוזת, וזה מייצר התאמות שגויות בולטות:
 * 'cake' מחזיר "Banana Pan**cake**s", ו-'bread' מחזיר "**Bread**fruit in
 * Butter Sauce". שתיהן תמונות שלא קשורות למתכון שהמשתמש כתב.
 *
 * כשאין אף התאמת מילה שלמה מחזירים את הרשימה המלאה - עדיף מועמד חלש
 * מאשר לרדת מדרגה בשרשרת ולהחזיר כלום.
 *
 * @param {Array} meals תוצאות מ-TheMealDB
 * @param {string} term מונח החיפוש ששימש
 */
function filterWholeWord(meals, term) {
  if (!Array.isArray(meals) || meals.length === 0) return [];

  const words = String(term).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return meals;

  const matches = meals.filter((meal) => {
    const name = String(meal?.strMeal || '').toLowerCase();
    return words.every((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(name);
    });
  });

  return matches.length > 0 ? matches : meals;
}

/**
 * בוחר פריט מרשימה לפי גיבוב של מפתח - יציב לאותו מפתח, שונה בין מפתחות.
 *
 * זה הלב של התיקון לבאג "כל מתכוני השוקולד קיבלו את אותה תמונה": קודם
 * הקוד לקח תמיד את התוצאה הראשונה, ולכן "עוגת שוקולד", "מוס שוקולד"
 * ו"בראוני" - שכולם נופלים למונח הרחב 'chocolate' - קיבלו את אותה
 * Chocolate Gateau. עכשיו כל שם מתכון בוחר תוצאה אחרת מתוך ה-16.
 *
 * @param {Array} items רשימת המועמדים
 * @param {string} seed מפתח הבחירה (שם המתכון)
 */
function pickStable(items, seed) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[stableHash(String(seed)) % items.length];
}

/**
 * גוזר קטגוריית TheMealDB משם מתכון בעברית.
 * @param {string} title
 * @returns {string|null}
 */
function deriveCategory(title) {
  if (typeof title !== 'string' || !title.trim()) return null;

  const normalized = title.trim();
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (matchesKeyword(normalized, keyword)) return category;
  }
  return null;
}

/**
 * גוזר מונחי חיפוש באנגלית משם מתכון בעברית, בלי שום קריאה ל-AI.
 *
 * מחזיר רשימה מסודרת מהספציפי לרחב, כדי שהקורא ינסה אותם בזה אחר זה:
 * "מוס שוקולד" -> ['chocolate mousse', 'chocolate'].
 *
 * @param {string} title שם המתכון (בדרך כלל בעברית)
 * @returns {string[]} מונחי חיפוש לפי סדר עדיפות; ריק אם לא זוהתה מילת מפתח
 */
function deriveSearchTerms(title) {
  if (typeof title !== 'string' || !title.trim()) return [];

  const normalized = title.trim();

  // ההתאמה הראשונה לפי סדר המילון (ספציפי -> כללי) קובעת
  for (const [keyword, term, broader] of KEYWORD_TERMS) {
    if (matchesKeyword(normalized, keyword)) {
      return broader ? [term, broader] : [term];
    }
  }

  return [];
}

/**
 * מחזיר תמונה קבועה למתכון לפי שמו המדויק, אם קיימת במפה.
 * @param {string} title
 * @returns {string|null}
 */
function getCuratedImage(title) {
  if (typeof title !== 'string') return null;
  return CURATED_IMAGES[title.trim()] || null;
}

module.exports = {
  CURATED_IMAGES,
  KEYWORD_TERMS,
  CATEGORY_KEYWORDS,
  deriveSearchTerms,
  deriveCategory,
  getCuratedImage,
  matchesKeyword,
  filterWholeWord,
  pickStable,
  stableHash,
};
