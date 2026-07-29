const fs = require('fs/promises');
const path = require('path');
const Recipe = require('../models/Recipe');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// כמה זמן קובץ "טרי" מוגן מפני מחיקה. תמונה נוצרת לפני שהמתכון נשמר,
// אז חייבים חלון שבו היא עדיין לא מקושרת לשום מתכון וזה בסדר גמור.
const GRACE_PERIOD_MS = 6 * 60 * 60 * 1000; // 6 שעות

/**
 * מוחק תמונות AI יתומות מתיקיית uploads (M9).
 *
 * הבעיה: /generate-image כותב קובץ לדיסק בכל פעם שמישהו מייצר מתכון -
 * גם אם המתכון מעולם לא נשמר, וגם אם המשתמש לחץ "תמונה אחרת" עשר פעמים.
 * בלי ניקוי, התיקייה גדלה בלי גבול.
 *
 * @returns {Promise<{deleted: number, kept: number, freedBytes: number}>}
 */
async function cleanupOrphanedUploads() {
  let files;
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return { deleted: 0, kept: 0, freedBytes: 0 }; // אין תיקייה = אין מה לנקות
    throw err;
  }

  // אוספים את שמות הקבצים שבשימוש בפועל לפי ה-imageUrl השמורים במסד
  const recipes = await Recipe.find({ imageUrl: /\/uploads\// }).select('imageUrl').lean();
  const inUse = new Set(
    recipes.map((r) => r.imageUrl.split('/uploads/')[1]).filter(Boolean)
  );

  const now = Date.now();
  let deleted = 0;
  let kept = 0;
  let freedBytes = 0;

  for (const file of files) {
    if (inUse.has(file)) {
      kept++;
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, file);
    const stats = await fs.stat(filePath);

    // קובץ שנוצר לפני רגע עשוי להיות של מתכון שהמשתמש עדיין עורך - לא נוגעים
    if (now - stats.mtimeMs < GRACE_PERIOD_MS) {
      kept++;
      continue;
    }

    await fs.unlink(filePath);
    freedBytes += stats.size;
    deleted++;
  }

  return { deleted, kept, freedBytes };
}

module.exports = { cleanupOrphanedUploads, UPLOADS_DIR };
