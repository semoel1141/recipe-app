import { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * "לא בא לי להכין - מי עושה לי את זה?"
 *
 * מציג מסעדות באזור המשתמש שמגישות מנה דומה. הנתונים מגיעים מ-OpenStreetMap
 * דרך השרת שלנו (ראו backend/routes/restaurantRoutes.js).
 *
 * שתי החלטות עיצוב שנובעות מאיכות הנתונים האמיתית:
 *
 * 1. טלפון מוצג רק כשהוא קיים. ב-OSM יש טלפון ל-28% מהמסעדות במרכז ת"א
 *    ול-9% בבאר שבע, ולכן "טלפון: —" היה מופיע ברוב הכרטיסים ומרגיש שבור.
 * 2. בכל כרטיס יש קישור למפות Google. שם תמיד יש טלפון, שעות פתיחה וניווט,
 *    בלי מפתח API ובלי עלות. זה מסלול הגיבוי האמיתי של הפיצ'ר.
 */
export default function RestaurantFinder({ dish }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | locating | loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // בודקים אם הפיצ'ר מופעל בשרת לפני שמציגים כפתור שאולי ייכשל
  useEffect(() => {
    const controller = new AbortController();

    api
      .get('/restaurants/status', { signal: controller.signal })
      .then(({ data }) => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(false)); // כולל שרת ישן בלי הנתיב הזה

    return () => controller.abort();
  }, []);

  /** מבקש מיקום מהדפדפן. דוחה עם הודעה בעברית כדי שהקורא יציג אותה כמו שהיא. */
  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('הדפדפן שלך לא תומך באיתור מיקום'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => {
          // PERMISSION_DENIED=1 - המשתמש סירב, וזה לא שגיאה שצריך להתנצל עליה
          reject(
            new Error(
              err.code === 1
                ? 'צריך הרשאת מיקום כדי למצוא מסעדות בקרבתך'
                : 'לא הצלחנו לאתר את המיקום שלך'
            )
          );
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    });

  const handleSearch = async () => {
    setError('');
    setStatus('locating');

    let coords;
    try {
      coords = await getPosition();
    } catch (err) {
      setError(err.message);
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const { data } = await api.get('/restaurants/nearby', {
        params: { lat: coords.latitude, lon: coords.longitude, dish },
      });
      setData(data);
      setStatus('done');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בחיפוש מסעדות');
      setStatus('error');
    }
  };

  if (!enabled) return null;

  // קישור גיבוי שלא דורש מיקום מהדפדפן - Google משתמש במיקום המשוער
  // של המשתמש בעצמו. מוצג כשאיתור המיקום נכשל או נדחה.
  const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dish)}`;

  const busy = status === 'locating' || status === 'loading';

  return (
    <section className="mt-10 border-t border-stone-200 pt-8">
      <h3 className="text-xl font-bold tracking-tight text-stone-900">לא בא לך להכין?</h3>
      <p className="mt-2 font-light leading-relaxed text-stone-500">
        נמצא מסעדות בקרבתך שמגישות משהו דומה.
      </p>

      {status !== 'done' && (
        <button
          onClick={handleSearch}
          disabled={busy}
          className="mt-4 rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'locating' && 'מאתר את המיקום שלך...'}
          {status === 'loading' && 'מחפש מסעדות...'}
          {(status === 'idle' || status === 'error') && 'מצא מסעדה שמכינה את זה'}
        </button>
      )}

      {error && (
        <div className="mt-4">
          <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
          {/* גם כשהאיתור נכשל אין סיבה להשאיר את המשתמש בלי כלום */}
          <a
            href={fallbackMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-stone-900 underline underline-offset-4 hover:text-stone-600"
          >
            חיפוש "{dish}" במפות Google ←
          </a>
        </div>
      )}

      {status === 'done' && data && (
        <div aria-live="polite">
          {data.degraded && (
            <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              שירות המפות החינמי לא זמין כרגע. אפשר לחפש ישירות במפות Google:
            </p>
          )}

          {!data.degraded && data.restaurants.length === 0 && (
            <p className="mt-4 font-light text-stone-500">לא נמצאו מסעדות בקרבתך.</p>
          )}

          {data.restaurants.length > 0 && (
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.restaurants.map((place) => (
                <li key={place.id} className="rounded-md bg-stone-100 p-4">
                  <p className="font-medium text-stone-900">{place.name}</p>

                  <p className="mt-1 text-sm font-light text-stone-500">
                    {[place.address, `${place.distanceKm} ק"מ`].filter(Boolean).join(' · ')}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {/* tel: פותח את החייגן בנייד - שווה הרבה יותר מטקסט בלבד */}
                    {place.phone && (
                      <a
                        href={`tel:${place.phone.replace(/[^+\d]/g, '')}`}
                        className="font-medium text-stone-900 underline underline-offset-4 hover:text-stone-600"
                      >
                        {place.phone}
                      </a>
                    )}
                    <a
                      href={place.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-stone-500 underline underline-offset-4 hover:text-stone-900"
                    >
                      {place.phone ? 'במפות' : 'טלפון ופרטים במפות'}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <a
              href={data.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-stone-900 underline underline-offset-4 hover:text-stone-600"
            >
              עוד תוצאות במפות Google ←
            </a>
            {/* חובה על פי רישיון ODbL של OpenStreetMap */}
            <span className="text-xs text-stone-400">{data.attribution}</span>
          </div>
        </div>
      )}
    </section>
  );
}
