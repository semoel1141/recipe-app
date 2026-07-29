const mongoose = require('mongoose');

// Schema - מגדיר את המבנה והחוקים של מסמך "מתכון" באוסף (collection) שיישמר במונגו
const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'שם המתכון הוא שדה חובה'],
      trim: true,
    },
    description: {
      type: String, // תיאור קצר של המנה (בעיקר ממתכונים שנוצרו ב-AI)
      default: '',
      trim: true,
    },
    ingredients: {
      type: [String], // מערך של מחרוזות, כל אחת מרכיב אחד (למשל "2 ביצים")
      required: [true, 'רשימת מרכיבים היא שדה חובה'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'צריך לפחות מרכיב אחד',
      },
    },
    // מחרוזת אחת, כששלבים מופרדים בשורה חדשה (\n).
    // נשאר String ולא [String] כדי לא לשבור את 17 המתכונים הקיימים ואת טופס העריכה הידני;
    // ה-AI מחזיר מערך שלבים, וה-route מאחד אותו ל-\n לפני השמירה. התצוגה מפצלת חזרה לרשימה ממוספרת.
    instructions: {
      type: String,
      required: [true, 'הוראות הכנה הן שדה חובה'],
    },
    prepTime: {
      type: Number, // בדקות
      default: 0,
    },
    servings: {
      type: Number,
      default: 1,
    },
    imageUrl: {
      type: String, // קישור לתמונה של המתכון (אופציונלי)
      default: '',
    },
    aiGenerated: {
      type: Boolean, // האם המתכון נוצר בעזרת AI - מאפשר לסמן/לסנן אותם בהמשך
      default: false,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // מפנה למסמך User - מאפשר populate כדי לקבל את פרטי היוצר
      required: true,
    },
  },
  {
    timestamps: true, // מוסיף אוטומטית createdAt ו-updatedAt לכל מסמך
  }
);

// אינדקסים על השדות שבהם באמת משתמשים לסינון ולמיון:
// - createdAt: כל שליפת רשימה ממוינת לפיו (sort({ createdAt: -1 }))
// - owner + createdAt: משמש בעמוד "המתכונים שלי"
//
// הערה מכוונת: **לא** הוספנו כאן text index לחיפוש. החיפוש באתר הוא
// "תוך כדי הקלדה" ומסתמך על התאמה חלקית (regex), ו-text index של מונגו
// מתאים רק למילים שלמות - הוא היה מזיק כאן ולא עוזר. ברמות נפח גדולות
// הפתרון הנכון הוא Atlas Search עם autocomplete, לא text index.
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Recipe', recipeSchema);
