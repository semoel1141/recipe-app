const rateLimit = require('express-rate-limit');

// הגבלות קצב לפי IP (C1).
// נתיבי ה-AI פתוחים בכוונה גם למשתמש לא מחובר - כך המשתמש יכול "לטעום" את הפיצ'ר
// לפני הרשמה. בלי הגבלת קצב זה אומר שכל אדם באינטרנט יכול לשרוף את מכסת Gemini
// ולמלא את הדיסק בתמונות. ההגבלות למטה סוגרות את זה בלי לפגוע במשתמש אמיתי.

// מסר שגיאה אחיד בפורמט JSON, כמו שאר ה-API
const message = (text) => ({ message: text });

// יצירת/שינוי מתכון בטקסט - קריאה זולה יחסית, אבל עדיין עולה כסף
const aiTextLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 דקות
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('יותר מדי בקשות AI. נסו שוב בעוד כמה דקות.'),
});

// יצירת תמונה - הפעולה היקרה ביותר, וגם כותבת קובץ לדיסק
const aiImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // שעה
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('הגעתם למכסת התמונות לשעה זו. נסו שוב מאוחר יותר.'),
});

// הרשמה/התחברות - מקשה על ניחוש סיסמאות בכוח גס
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // רק ניסיונות כושלים נספרים
  message: message('יותר מדי ניסיונות התחברות. נסו שוב בעוד 15 דקות.'),
});

// חיפוש מסעדות - פונה ל-Overpass הציבורי, שהוא שירות התנדבותי עם מדיניות
// שימוש הוגן. בפועל הוא מחזיר שגיאות עומס כבר בכמה שאילתות רצופות, ולכן
// ההגבלה כאן נועדה להגן עליו לא פחות מאשר עלינו. רוב הבקשות ממילא נענות
// מהקאש במונגו ולא מגיעות אליו בכלל.
const restaurantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('יותר מדי חיפושי מסעדות. נסו שוב בעוד כמה דקות.'),
});

module.exports = { aiTextLimiter, aiImageLimiter, authLimiter, restaurantLimiter };
