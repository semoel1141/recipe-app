/**
 * לקוח ל-Overpass API - שאילתות על נתוני OpenStreetMap.
 *
 * למה OSM ולא Google Places: Google דורש חשבון חיוב עם כרטיס אשראי
 * גם למכסה החינמית. OSM חינמי לגמרי ובלי מפתח.
 *
 * המחיר של הבחירה הזו, במספרים שנמדדו בפועל (יולי 2026):
 *  - מרכז ת"א: 173 מסעדות, 83% עם שם, אבל רק 28% עם טלפון
 *  - באר שבע:   95 מסעדות, 9% עם טלפון
 *  - תיוג cuisine בעברית כמעט לא קיים ("falafel" החזיר 3 תוצאות ב-8 ק"מ מת"א)
 *
 * המסקנה שמעצבת את הקוד כאן: **אסור להבטיח טלפון**. הראוט מחזיר טלפון
 * כשהוא קיים, ותמיד מצרף קישור למפות Google - שם הטלפון ושעות הפתיחה
 * תמיד זמינים, בחינם ובלי מפתח.
 */

// שרתים ציבוריים, לפי סדר ניסיון. הראשי נופל תחת עומס לא פעם,
// ולכן יש גיבוי - ואם גם הוא נכשל, הראוט עובר למצב מנוון (degraded).
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// מדיניות השימוש של Overpass דורשת User-Agent מזהה. בלעדיו עלולים לחסום.
const USER_AGENT = 'recipe-app/1.0 (restaurant finder; contact via app)';

// זמנים קצרים בכוונה: זו בקשה שמשתמש מחכה לה מול המסך. עדיף ליפול
// למסלול המפות אחרי 15 שניות מאשר להחזיק אותו דקה מול ספינר.
const QUERY_TIMEOUT_SECONDS = 12;
const FETCH_TIMEOUT_MS = 15000;

const AMENITIES = '^(restaurant|fast_food|cafe)$';

/**
 * תקרת מספר התוצאות בשאילתה.
 *
 * המספר נבחר לפי מדידה ולא בהערכה: ברדיוס 3 ק"מ ממרכז תל אביב - האזור
 * הצפוף ביותר בישראל - יש 785 בתי אוכל. תקרה נמוכה מזה חותכת שרירותית,
 * ו-Overpass לא מחזיר לפי מרחק, כך שהחיתוך היה מפיל גם מקומות קרובים.
 * זה בדיוק מה שקרה עם תקרת 200: כל מקומות הפלאפל נעלמו מהתוצאות.
 */
const MAX_ELEMENTS = 1000;

/**
 * מרחק בקו אווירי בין שתי נקודות, בקילומטרים (נוסחת haversine).
 */
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // רדיוס כדור הארץ בק"מ
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * מרכיב כתובת קריאה מתגי addr:* של OSM. מחזיר מחרוזת ריקה כשאין מספיק מידע.
 */
function buildAddress(tags) {
  const street = tags['addr:street'];
  const house = tags['addr:housenumber'];
  const city = tags['addr:city'];

  const line = [street, house].filter(Boolean).join(' ');
  return [line, city].filter(Boolean).join(', ');
}

/**
 * קישור חיפוש ב-Google Maps. לא דורש מפתח API ולא נספר במכסה כלשהי -
 * זה פורמט כתובת מתועד. כאן נמצא הטלפון כש-OSM לא מכיר אותו.
 */
function buildMapsUrl(name, address, lat, lon) {
  // שם + כתובת מזהים את המקום טוב יותר מקואורדינטות, אבל אם אין שם
  // נופלים לקואורדינטות כדי שהקישור עדיין יוביל למקום הנכון
  const query = name ? [name, address].filter(Boolean).join(', ') : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * קישור לחיפוש חופשי במפות Google, ממורכז על מיקום המשתמש.
 *
 * זהו מסלול הגיבוי המרכזי של הפיצ'ר: כש-OSM לא מכיר טלפון (רוב המקרים),
 * או כש-Overpass לא זמין בכלל, הקישור הזה עדיין נותן למשתמש מסעדות
 * עם טלפון, שעות פתיחה, ביקורות וניווט - בחינם ובלי מפתח.
 */
function buildSearchUrl(query, lat, lon) {
  // הפורמט /@lat,lon,zoom ממרכז את המפה על המשתמש, כך שהתוצאות מקומיות
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lon},14z`;
}

/**
 * בונה שאילתת Overpass QL עבור כל בתי האוכל סביב נקודה.
 *
 * במכוון **בלי סינון לפי cuisine**, משלוש סיבות:
 *  1. תיוג cuisine בישראל דליל - סינון בשאילתה החזיר 0-3 תוצאות והצריך
 *     שאילתות חוזרות עם רדיוס גדל, כלומר עד שלוש פניות לשירות התנדבותי
 *     על צפייה אחת במתכון.
 *  2. תוצאה אחת לאזור משרתת את *כל* המתכונים באתר, במקום מפתח קאש נפרד
 *     לכל מטבח. פחות פניות ל-Overpass בסדר גודל.
 *  3. אין כאן שום מחרוזת שמקורה במשתמש או ב-AI - רק מספרים שעברו ולידציה.
 *     ההתאמה למטבח נעשית אצלנו על התוצאות (ראו rankByCuisine).
 */
function buildQuery({ lat, lon, radiusMeters }) {
  const area = `(around:${radiusMeters},${lat},${lon})`;

  // גם node וגם way: מסעדה יכולה להיות מסומנת כנקודה או כמתאר של מבנה.
  // "out center" מחזיר ל-way נקודת מרכז, כך שיש קואורדינטות לשניהם.
  return `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];
(
  node["amenity"~"${AMENITIES}"]${area};
  way["amenity"~"${AMENITIES}"]${area};
);
out center tags ${MAX_ELEMENTS};`;
}

/**
 * מריץ שאילתה מול Overpass, עם מעבר לשרת גיבוי בכישלון.
 * @returns {Promise<Array>} elements גולמיים של OSM
 * @throws כשכל השרתים נכשלו
 */
async function runQuery(query) {
  let lastError = null;

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        lastError = new Error(`Overpass ${endpoint} החזיר ${response.status}`);
        continue;
      }

      // כשהשרת עמוס הוא מחזיר דף HTML עם הודעת שגיאה במקום JSON,
      // עם status 200 - ולכן בודקים את גוף התשובה ולא רק את הסטטוס
      const text = await response.text();
      if (!text.trim().startsWith('{')) {
        lastError = new Error(`Overpass ${endpoint} החזיר תשובה שאינה JSON (כנראה עומס)`);
        continue;
      }

      return JSON.parse(text).elements || [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('כל שרתי Overpass נכשלו');
}

/**
 * ממיר element גולמי של OSM למבנה שהלקוח מצפה לו.
 * מחזיר null כשאין מספיק מידע כדי להציג את המקום.
 */
function normalize(element) {
  const tags = element.tags || {};
  const name = (tags.name || '').trim();

  // בלי שם אי אפשר להציג כרטיס משמעותי - מדלגים
  if (!name) return null;

  // ל-node הקואורדינטות ישירות על האובייקט, ל-way הן תחת center
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const address = buildAddress(tags);

  return {
    id: `${element.type}/${element.id}`,
    name,
    address,
    // OSM מאחסן טלפון תחת שני תגים שונים, תלוי מי ערך את המקום
    phone: tags.phone || tags['contact:phone'] || '',
    cuisine: tags.cuisine || '',
    lat,
    lon,
    mapsUrl: buildMapsUrl(name, address, lat, lon),
  };
}

/**
 * מחפש בתי אוכל סביב נקודה.
 *
 * @param {{lat:number, lon:number, radiusMeters?:number}} options
 * @returns {Promise<Array>} מקומות מנורמלים (בלי מרחק - הוא מחושב בראוט)
 */
async function findRestaurants({ lat, lon, radiusMeters = 5000 }) {
  const elements = await runQuery(buildQuery({ lat, lon, radiusMeters }));
  return elements.map(normalize).filter(Boolean);
}

/**
 * מסמן אילו מקומות באמת תואמים למטבח המבוקש, וממיין את התואמים לראש.
 *
 * הדגל matchesDish הוא העיקר כאן, לא המיון. בלעדיו הלקוח הציג את כל
 * התוצאות תחת הכותרת "מסעדות שמגישות משהו דומה" - וזו הייתה טענה שקרית:
 * למתכון עוגת שוקולד רק 3 מתוך 12 באמת התאימו, והשאר היו סתם המסעדות
 * הקרובות ביותר (פלאפל, פיצה, המבורגר). המשתמש ראה מסעדת שניצל מתחת
 * לכותרת שהבטיחה מנה דומה, ובצדק חשב שהפיצ'ר שבור.
 *
 * ההתאמה מכילה (`includes`) ולא שוויון, כי OSM מאחסן כמה מטבחים במחרוזת
 * אחת מופרדת בנקודה-פסיק, למשל "falafel;hummus;middle_eastern".
 *
 * כשאין מטבח מבוקש אף מקום לא מסומן כתואם, והמיון הוא לפי מרחק בלבד.
 */
function rankByCuisine(places, cuisine) {
  const wanted = String(cuisine || '').toLowerCase();

  const tagged = places.map((place) => ({
    ...place,
    matchesDish: Boolean(wanted) && place.cuisine.toLowerCase().includes(wanted),
  }));

  return tagged.sort((a, b) => {
    if (a.matchesDish !== b.matchesDish) return a.matchesDish ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
}

module.exports = {
  findRestaurants,
  rankByCuisine,
  distanceKm,
  buildMapsUrl,
  buildSearchUrl,
  // מיוצאים לצורך בדיקות
  buildQuery,
  normalize,
};
