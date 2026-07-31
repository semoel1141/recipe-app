const mongoose = require('mongoose');

/**
 * קאש כללי לתוצאות שמגיעות משירותים חיצוניים חינמיים (Overpass, Gemini).
 *
 * למה בכלל קאש כאן ולא בזיכרון: השרת ב-Render בתוכנית החינמית נכבה
 * אחרי חוסר פעילות, כך שקאש בזיכרון מתאפס כל כמה עשרות דקות ולא שווה כלום.
 * חוץ מזה, ל-Overpass הציבורי יש מדיניות שימוש הוגן - הוא מחזיר שגיאות
 * עומס כבר בכמה שאילתות רצופות (נמדד בפועל), ולכן חובה לא לפנות אליו
 * שוב על כל צפייה במתכון.
 *
 * kind מפריד בין סוגי הערכים כדי לא ליצור collection נפרד לכל אחד:
 *  - 'places'  : רשימת מסעדות סביב נקודה מעוגלת
 *  - 'cuisine' : מיפוי שם מתכון -> תג cuisine של OSM
 */
const placesCacheSchema = new mongoose.Schema(
  {
    // מפתח מורכב, למשל "places:32.08,34.78:falafel" או "cuisine:סלט ישראלי"
    key: {
      type: String,
      required: true,
      unique: true,
    },
    kind: {
      type: String,
      enum: ['places', 'cuisine'],
      required: true,
    },
    // Mixed כי המבנה שונה בין הסוגים (מערך מסעדות מול מחרוזת אחת)
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // מונגו מוחק את המסמך אוטומטית כשמגיע הזמן הזה (TTL index למטה).
    // בלי זה הקאש היה מחזיק נתוני OSM ישנים לנצח.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index - מונגו סורק כל ~60 שניות ומוחק מסמכים שעבר זמנם.
// expireAfterSeconds: 0 אומר "מחק כשהתאריך בשדה expiresAt עבר".
placesCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PlacesCache', placesCacheSchema);
