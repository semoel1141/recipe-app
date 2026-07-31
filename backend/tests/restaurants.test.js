const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-only-not-production';
// הדגל נקרא ברמת המודול ב-restaurantRoutes, ולכן חייב להיות מוגדר לפני ה-require
process.env.RESTAURANT_FINDER = 'true';
// בלי מפתח Gemini, resolveCuisine נופל בשקט ל-'' (חיפוש בלי סינון מטבח).
// מוחקים אותו במפורש כדי שהבדיקות לא יתנהגו אחרת על מכונה שיש בה מפתח.
delete process.env.GEMINI_API_KEY;

const createApp = require('../app');
const PlacesCache = require('../models/PlacesCache');
const { buildQuery, normalize, rankByCuisine } = require('../config/overpass');
const { connectTestDb, closeTestDb, clearTestDb } = require('./setup');

const app = createApp();

// מרכז תל אביב - נקודת הייחוס של כל הבדיקות
const LAT = 32.0853;
const LON = 34.7818;

// שלושה מקומות עם שם (מתחת לזה הראוט מרחיב את החיפוש ומוציא קריאה נוספת),
// ועוד אחד בלי שם שאמור להיות מסונן החוצה
const OSM_RESPONSE = {
  elements: [
    {
      type: 'node',
      id: 2,
      lat: 32.15,
      lon: 34.85,
      tags: { name: 'מסעדה רחוקה', amenity: 'restaurant' },
    },
    {
      type: 'node',
      id: 1,
      lat: 32.0860,
      lon: 34.7820,
      tags: {
        name: 'פלאפל הקוסם',
        amenity: 'fast_food',
        cuisine: 'falafel',
        phone: '+972-3-525-2033',
        'addr:street': 'דיזנגוף',
        'addr:housenumber': '1',
        'addr:city': 'תל אביב',
      },
    },
    {
      // way מחזיר קואורדינטות תחת center ולא ישירות על האובייקט
      type: 'way',
      id: 3,
      center: { lat: 32.09, lon: 34.79 },
      tags: { name: 'מסעדת בניין', amenity: 'restaurant' },
    },
    {
      type: 'node',
      id: 4,
      lat: 32.0855,
      lon: 34.7819,
      tags: { amenity: 'restaurant' }, // בלי שם - לא ניתן להצגה
    },
  ],
};

/** מחליף את fetch הגלובלי בתשובת Overpass מזויפת. */
function mockOverpass(body = OSM_RESPONSE) {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  global.fetch = spy;
  return spy;
}

beforeAll(connectTestDb, 60000);
afterAll(closeTestDb);
beforeEach(async () => {
  await clearTestDb();
  vi.restoreAllMocks();
});

describe('GET /api/restaurants/status', () => {
  it('מדווח שהפיצ׳ר מופעל', async () => {
    const res = await request(app).get('/api/restaurants/status');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });
});

describe('GET /api/restaurants/nearby - ולידציה', () => {
  // רשת ביטחון: אם ולידציה תישבר ובקשה פסולה תמשיך הלאה, הבדיקה תיפול מיד
  // עם שגיאה ברורה במקום לתלות 30 שניות על קריאת רשת אמיתית ל-Overpass
  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new Error('הוולידציה הייתה אמורה לעצור את הבקשה'));
  });

  it('דוחה בקשה בלי קואורדינטות', async () => {
    const res = await request(app).get('/api/restaurants/nearby').query({ dish: 'פלאפל' });

    expect(res.status).toBe(400);
  });

  it('דוחה קואורדינטות מחוץ לטווח', async () => {
    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: 999, lon: LON, dish: 'פלאפל' });

    expect(res.status).toBe(400);
  });

  it('דוחה lat ריק (Number("") הוא 0 - הוולידציה חייבת לתפוס את זה)', async () => {
    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: '', lon: '', dish: 'פלאפל' });

    expect(res.status).toBe(400);
  });

  it('דוחה בקשה בלי שם מנה', async () => {
    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/restaurants/nearby - תוצאות', () => {
  it('מחזיר מסעדות ממוינות לפי מרחק, בלי אלה שאין להן שם', async () => {
    mockOverpass();

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(false);

    const names = res.body.restaurants.map((r) => r.name);
    // המקום בלי שם סונן, והשאר ממוינים מהקרוב לרחוק
    expect(names).toEqual(['פלאפל הקוסם', 'מסעדת בניין', 'מסעדה רחוקה']);
  });

  it('מרכיב כתובת וטלפון כשהם קיימים ב-OSM', async () => {
    mockOverpass();

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    const falafel = res.body.restaurants.find((r) => r.name === 'פלאפל הקוסם');
    expect(falafel.address).toBe('דיזנגוף 1, תל אביב');
    expect(falafel.phone).toBe('+972-3-525-2033');
    expect(falafel.distanceKm).toBeLessThan(1);
  });

  it('מחזיר טלפון ריק במקום לקרוס כשאין תג טלפון', async () => {
    mockOverpass();

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    const noPhone = res.body.restaurants.find((r) => r.name === 'מסעדה רחוקה');
    expect(noPhone.phone).toBe('');
    // הקישור למפות הוא הגיבוי, ולכן חייב להיות תמיד
    expect(noPhone.mapsUrl).toContain('google.com/maps');
  });

  it('תמיד מצרף קישור חיפוש במפות וייחוס ל-OSM', async () => {
    mockOverpass();

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    expect(res.body.searchUrl).toContain('google.com/maps');
    expect(res.body.attribution).toContain('OpenStreetMap');
  });
});

describe('GET /api/restaurants/nearby - עמידות וקאש', () => {
  it('נכשל ברכות כש-Overpass לא זמין: 200 עם קישור מפות במקום שגיאה', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    // השגיאה נרשמת ללוג בכוונה; משתיקים כדי לא ללכלך את פלט הבדיקות
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.restaurants).toEqual([]);
    expect(res.body.searchUrl).toContain('google.com/maps');
  });

  it('מזהה תשובת HTML של שרת עמוס ולא מנסה לפרסר אותה כ-JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<?xml version="1.0"?><html>Error: runtime error</html>',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
  });

  it('הבקשה השנייה נענית מהקאש ולא פונה שוב ל-Overpass', async () => {
    const spy = mockOverpass();

    const query = { lat: LAT, lon: LON, dish: 'פלאפל' };
    await request(app).get('/api/restaurants/nearby').query(query);
    const callsAfterFirst = spy.mock.calls.length;

    // מיקום מעט שונה, אבל מתעגל לאותה נקודה - חייב לפגוע באותו מפתח קאש
    await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT + 0.001, lon: LON + 0.001, dish: 'פלאפל' });

    expect(spy.mock.calls.length).toBe(callsAfterFirst);
    expect(await PlacesCache.countDocuments({ kind: 'places' })).toBe(1);
  });

  it('שומר בקאש עם תאריך תפוגה, כדי שנתוני OSM לא יישארו לנצח', async () => {
    mockOverpass();

    await request(app)
      .get('/api/restaurants/nearby')
      .query({ lat: LAT, lon: LON, dish: 'פלאפל' });

    const doc = await PlacesCache.findOne({ kind: 'places' });
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('בניית שאילתת Overpass', () => {
  it('לא מכניס לשאילתה שום מחרוזת שמקורה במשתמש או ב-AI', () => {
    const query = buildQuery({ lat: LAT, lon: LON, radiusMeters: 5000 });

    // הסינון לפי מטבח נעשה אצלנו (rankByCuisine) ולא בשאילתה, ולכן
    // אין כאן משטח הזרקה בכלל - רק מספרים שעברו ולידציה
    expect(query).not.toContain('cuisine');
    expect(query).toContain('(around:5000,32.0853,34.7818)');
  });
});

describe('דירוג לפי מטבח', () => {
  const places = [
    { name: 'קרוב, מטבח אחר', cuisine: 'burger', distanceKm: 0.2 },
    { name: 'רחוק, מטבח תואם', cuisine: 'falafel', distanceKm: 3.0 },
    { name: 'בינוני, מטבח תואם', cuisine: 'falafel;hummus', distanceKm: 1.5 },
    { name: 'בינוני, בלי תיוג', cuisine: '', distanceKm: 1.0 },
  ];

  it('מעלה מסעדות תואמות לראש, וממיין בתוך כל קבוצה לפי מרחק', () => {
    const ranked = rankByCuisine(places, 'falafel').map((p) => p.name);

    expect(ranked).toEqual([
      'בינוני, מטבח תואם',
      'רחוק, מטבח תואם',
      'קרוב, מטבח אחר',
      'בינוני, בלי תיוג',
    ]);
  });

  it('ממיין לפי מרחק בלבד כשאין מטבח מבוקש', () => {
    const ranked = rankByCuisine(places, '').map((p) => p.distanceKm);

    expect(ranked).toEqual([0.2, 1.0, 1.5, 3.0]);
  });

  it('לא משנה את המערך המקורי', () => {
    const before = places.map((p) => p.name);
    rankByCuisine(places, 'falafel');

    expect(places.map((p) => p.name)).toEqual(before);
  });
});

describe('נרמול element של OSM', () => {
  it('מדלג על מקום בלי שם', () => {
    expect(normalize({ type: 'node', id: 1, lat: 32, lon: 34, tags: { amenity: 'restaurant' } })).toBeNull();
  });

  it('מדלג על מקום בלי קואורדינטות', () => {
    expect(normalize({ type: 'way', id: 1, tags: { name: 'בלי מיקום' } })).toBeNull();
  });

  it('קורא טלפון גם מהתג contact:phone', () => {
    const place = normalize({
      type: 'node',
      id: 1,
      lat: 32,
      lon: 34,
      tags: { name: 'מקום', 'contact:phone': '03-1234567' },
    });

    expect(place.phone).toBe('03-1234567');
  });
});
