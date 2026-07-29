import { API_ORIGIN } from '../api/axios';

/**
 * מרכיב כתובת תמונה מלאה מהערך שנשמר במסד (C4).
 *
 * במסד יכולים להופיע שלושה סוגי ערכים:
 *   1. נתיב יחסי מהשרת שלנו   -> "/uploads/abc.png"  (הפורמט החדש)
 *   2. כתובת חיצונית מלאה     -> "https://themealdb.com/..." (תצלומי גיבוי, וקישורים שמשתמש הדביק)
 *   3. כתובת מלאה ישנה        -> "http://localhost:5000/uploads/abc.png" (רשומות שנשמרו לפני התיקון)
 *
 * הפונקציה מטפלת בשלושתם, כך שאין צורך במיגרציה של הנתונים הקיימים.
 *
 * @param {string} [src] הערך כפי שנשמר ב-imageUrl
 * @returns {string} כתובת שאפשר להכניס ל-<img src>
 */
export function resolveImageUrl(src) {
  if (!src) return '';

  const value = String(src).trim();

  // רשומות ישנות עם localhost קשיח - ממפים אותן לשרת שהלקוח מדבר איתו בפועל
  const legacyMatch = value.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/uploads\/.+)$/i);
  if (legacyMatch) {
    return `${API_ORIGIN}${legacyMatch[3]}`;
  }

  // כתובת חיצונית מלאה (או data:) - מחזירים כמו שהיא
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  // נתיב יחסי של השרת שלנו
  if (value.startsWith('/')) {
    return `${API_ORIGIN}${value}`;
  }

  return value;
}
