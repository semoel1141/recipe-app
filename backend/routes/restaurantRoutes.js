const express = require('express');
const router = express.Router();
const PlacesCache = require('../models/PlacesCache');
const { restaurantLimiter } = require('../middleware/rateLimit');
const { findRestaurants, rankByCuisine, distanceKm, buildSearchUrl } = require('../config/overpass');
const { suggestCuisineTag } = require('../config/gemini');

/**
 * מציאת מסעדות שמגישות מנה דומה למתכון.
 *
 * כבוי כברירת מחדל. הפיצ'ר נשען על Overpass הציבורי (OpenStreetMap),
 * שהוא שירות התנדבותי - הפעלה בלי קאש תקין או בלי הגבלת קצב היא שימוש
 * לא הוגן בו. ראו config/overpass.js למספרי הכיסוי האמיתיים בישראל.
 */
const RESTAURANT_FINDER = process.env.RESTAURANT_FINDER === 'true';

// חובה על פי רישיון ODbL של OpenStreetMap כשמציגים את הנתונים
const ATTRIBUTION = '© מפתחי OpenStreetMap';

const PLACES_TTL_MS = 7 * 24 * 60 * 60 * 1000; // נתוני OSM משתנים לאט
const CUISINE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // שם מתכון -> מטבח לא משתנה כלל
// 3 ק"מ ולא יותר: זה טווח סביר ל"איפה אוכל את זה עכשיו", ובאזור הצפוף
// ביותר בישראל הוא מחזיר 785 מקומות - עדיין מתחת לתקרת השאילתה,
// כך שאין חיתוך שרירותי של תוצאות (ראו MAX_ELEMENTS ב-config/overpass.js)
const DEFAULT_RADIUS_M = 3000;
const WIDE_RADIUS_M = 15000; // ניסיון שני כשאין תוצאות ברדיוס הרגיל
const MAX_RESULTS = 12;
// כמה מסעדות "סתם בסביבה" להציג כשאין מספיק התאמות אמיתיות
const MAX_OTHER_NEARBY = 4;
const MIN_RESULTS_BEFORE_WIDENING = 3;

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * מעגל קואורדינטות לשתי ספרות אחרי הנקודה (~1.1 ק"מ).
 *
 * שתי מטרות בבת אחת: מפתח קאש שמשותף לכל מי שנמצא באותו אזור (אחרת
 * לכל משתמש היה מפתח ייחודי והקאש היה חסר תועלת), ושמירה על פרטיות -
 * המיקום המדויק של המשתמש לא נשמר במסד ולא נשלח ל-Overpass.
 *
 * המרחק המוצג עדיין מדויק, כי הוא מחושב מהקואורדינטות האמיתיות בזיכרון
 * בלבד, מול הקואורדינטות של המסעדה.
 */
const roundCoord = (value) => Math.round(value * 100) / 100;

/**
 * מפרסר קואורדינטה מפרמטר שאילתה. מחזיר null כשהערך אינו תקין.
 *
 * הבדיקה על המחרוזת הגולמית קודמת להמרה בכוונה: Number('') ו-Number(' ')
 * מחזירים 0, שהוא ערך *תקין לחלוטין* מבחינת טווח - כך ש-lat=&lon= היה
 * עובר ולידציה ושולח את המשתמש לחיפוש באוקיינוס האטלנטי (נקודה 0,0).
 *
 * @param {unknown} raw - הערך מ-req.query
 * @param {number} max - הגבול העליון בערך מוחלט (90 ל-lat, 180 ל-lon)
 * @returns {number|null}
 */
function parseCoord(raw, max) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < -max || value > max) return null;
  return value;
}

/** קורא מהקאש; מחזיר null כשאין ערך תקף. */
async function readCache(key) {
  const hit = await PlacesCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  return hit ? hit.payload : null;
}

/** כותב לקאש (upsert, כדי לא להתנגש עם מפתח קיים שפג). */
async function writeCache(key, kind, payload, ttlMs) {
  await PlacesCache.updateOne(
    { key },
    { key, kind, payload, expiresAt: new Date(Date.now() + ttlMs) },
    { upsert: true }
  );
}

/**
 * מתרגם שם מתכון לתג cuisine, עם קאש.
 * לעולם לא זורק - בלי מפתח Gemini או בכשל כלשהו מחזיר '' (חיפוש בלי סינון).
 */
async function resolveCuisine(dish) {
  const key = `cuisine:${dish.toLowerCase()}`;

  const cached = await readCache(key);
  // '' הוא ערך תקף במטמון ("נבדק, אין התאמה"), ולכן בודקים null במפורש
  if (cached !== null) return cached;

  let cuisine = '';
  try {
    cuisine = await suggestCuisineTag(dish);
  } catch {
    // אין מפתח Gemini, או שהמודל נכשל - ממשיכים בלי סינון מטבח
    return '';
  }

  await writeCache(key, 'cuisine', cuisine, CUISINE_TTL_MS);
  return cuisine;
}

/**
 * שולף בתי אוכל סביב נקודה מעוגלת, עם קאש.
 *
 * מפתח הקאש **לא כולל מטבח**: השאילתה מביאה את כל בתי האוכל באזור, וההתאמה
 * למנה נעשית אחר כך בזיכרון. כך רשומה אחת בקאש משרתת את כל המתכונים באתר
 * עבור אותו אזור, במקום פנייה נפרדת ל-Overpass לכל סוג מנה.
 *
 * @returns {Promise<Array>} רשימת מקומות (ללא מרחק)
 */
async function getPlaces(roundedLat, roundedLon) {
  const key = `places:${roundedLat},${roundedLon}`;

  const cached = await readCache(key);
  if (cached !== null) return cached;

  let places = await findRestaurants({
    lat: roundedLat,
    lon: roundedLon,
    radiusMeters: DEFAULT_RADIUS_M,
  });

  // הרחבה רק כשבאמת אין כלום (אזור כפרי). ברדיוס 5 ק"מ ובלי סינון מטבח
  // זה מקרה נדיר, ולכן ברוב המוחלט של הבקשות יוצאת פנייה אחת בלבד.
  if (places.length < MIN_RESULTS_BEFORE_WIDENING) {
    places = await findRestaurants({
      lat: roundedLat,
      lon: roundedLon,
      radiusMeters: WIDE_RADIUS_M,
    });
  }

  await writeCache(key, 'places', places, PLACES_TTL_MS);
  return places;
}

/**
 * GET /api/restaurants/status
 * מאפשר ללקוח להסתיר את הפיצ'ר לגמרי כשהוא כבוי, במקום להציג כפתור שנכשל.
 */
router.get('/status', (req, res) => {
  res.json({ enabled: RESTAURANT_FINDER });
});

/**
 * GET /api/restaurants/nearby?lat=&lon=&dish=
 *
 * פתוח גם למשתמש לא מחובר, כמו נתיבי ה-AI - אבל מוגבל בקצב.
 */
router.get(
  '/nearby',
  restaurantLimiter,
  asyncHandler(async (req, res) => {
    if (!RESTAURANT_FINDER) {
      return res.status(503).json({
        message: 'חיפוש מסעדות אינו זמין כרגע.',
        enabled: false,
      });
    }

    const dish = String(req.query.dish || '').trim().slice(0, 120);

    const lat = parseCoord(req.query.lat, 90);
    const lon = parseCoord(req.query.lon, 180);
    if (lat === null || lon === null) {
      return res.status(400).json({ message: 'חסרות קואורדינטות תקינות (lat/lon)' });
    }
    if (!dish) {
      return res.status(400).json({ message: 'חסר שם המנה לחיפוש' });
    }

    const cuisine = await resolveCuisine(dish);
    // תמיד זמין, גם כש-Overpass נופל - זה מה שהופך כישלון לרך
    const searchUrl = buildSearchUrl(dish, lat, lon);

    let places;
    try {
      places = await getPlaces(roundCoord(lat), roundCoord(lon));
    } catch (error) {
      // Overpass לא זמין. לא מחזירים שגיאה ללקוח: המשתמש עדיין מקבל
      // קישור למפות, שהוא ממילא המקור הטוב יותר לטלפון ולשעות פתיחה.
      console.error('[overpass]', error.message);
      return res.json({
        degraded: true,
        cuisine,
        searchUrl,
        restaurants: [],
        attribution: ATTRIBUTION,
      });
    }

    // המרחק מחושב מהמיקום האמיתי (שלא נשמר בשום מקום), ולכן מדויק
    // למרות שהחיפוש עצמו נעשה סביב נקודה מעוגלת
    const withDistance = places.map((place) => ({
      ...place,
      distanceKm: Number(distanceKm(lat, lon, place.lat, place.lon).toFixed(1)),
    }));

    const ranked = rankByCuisine(withDistance, cuisine);

    // שתי קבוצות נפרדות, ובכוונה. המקומות התואמים הם התשובה לשאלה ששאל
    // המשתמש; השאר הם רק "מה יש בסביבה", והלקוח מציג אותם תחת כותרת משלהם
    // כדי לא להבטיח שהם מגישים את המנה. בלי ההפרדה הזו מתכון עוגת שוקולד
    // הציג מסעדת שניצל ככזו שמכינה אותו.
    const matches = ranked.filter((place) => place.matchesDish).slice(0, MAX_RESULTS);
    // מעט בלבד: אלה נתוני הקשר, לא תוצאות. רשימה ארוכה של מסעדות לא
    // רלוונטיות רק מטביעה את התואמות.
    const others = ranked.filter((place) => !place.matchesDish).slice(0, MAX_OTHER_NEARBY);

    res.json({
      degraded: false,
      cuisine,
      searchUrl,
      matchCount: matches.length,
      restaurants: [...matches, ...others],
      attribution: ATTRIBUTION,
    });
  })
);

module.exports = router;
