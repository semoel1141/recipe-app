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
 */
const KEYWORD_TERMS = [
  // מאפים וקינוחים - לפני "עוגה" הכללי
  ['עוגת גבינה', 'cheesecake'],
  ['עוגת שוקולד', 'chocolate cake', 'chocolate'],
  ['מוס שוקולד', 'chocolate mousse', 'chocolate'],
  ['עוגיות', 'cookies', 'dessert'],
  ['בראוני', 'brownies', 'chocolate'],
  ['פנקייק', 'pancakes'],
  ['וופל', 'waffles', 'dessert'],
  ['קרפ', 'crepe', 'dessert'],
  ['עוגה', 'cake'],
  ['טירמיסו', 'tiramisu', 'dessert'],
  ['גלידה', 'ice cream', 'dessert'],
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
    if (normalized.includes(keyword)) {
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
  deriveSearchTerms,
  getCuratedImage,
};
