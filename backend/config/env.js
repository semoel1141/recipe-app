// בדיקת משתני סביבה בעליית השרת (H9).
// בלי זה השרת עולה "בהצלחה" גם כשחסר JWT_SECRET, וכל ניסיון התחברות
// נכשל אחר כך ב-500 מסתורי שקשה מאוד לאתר.
const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

// לא חובה לעליית השרת - רק ה-routes של ה-AI לא יעבדו בלעדיו
const OPTIONAL = ['GEMINI_API_KEY'];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error('\n❌ חסרים משתני סביבה חיוניים בקובץ backend/.env:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nראו backend/.env.example לדוגמה מלאה.\n');
    process.exit(1);
  }

  // סוד קצר מדי הופך את הטוקנים לניתנים לפיצוח בכוח גס
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET קצר מ-32 תווים - מומלץ סוד ארוך ואקראי יותר.');
  }

  const missingOptional = OPTIONAL.filter((key) => !process.env[key]?.trim());
  if (missingOptional.length > 0) {
    console.warn(`⚠️  ${missingOptional.join(', ')} לא מוגדר - נתיבי ה-AI יחזירו 503.`);
  }
}

module.exports = validateEnv;
