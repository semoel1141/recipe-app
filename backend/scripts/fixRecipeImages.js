/**
 * מתקן תמונות של מתכונים קיימים במסד.
 *
 * הרצה:
 *   node scripts/fixRecipeImages.js          - הרצה יבשה, רק מדווח מה ישתנה
 *   node scripts/fixRecipeImages.js --apply  - מבצע את העדכון בפועל
 *
 * ---------------------------------------------------------------------------
 * מה הסקריפט מתקן
 * ---------------------------------------------------------------------------
 * 1. כתובות loremflickr.com - שירות תמונות **אקראיות**. אותה כתובת החזירה
 *    צילום שונה בכל בקשה, ולרוב לא של המנה הנכונה.
 * 2. מתכוני AI שקיבלו תמונה גנרית זהה (או שנשארו בלי תמונה בכלל) בגלל
 *    נפילה ל-findStockPhoto('food').
 * 3. נתיבים יחסיים ל-/uploads שהקבצים שלהם כבר לא קיימים - הדיסק ב-Render
 *    הוא ephemeral ונמחק בכל פריסה.
 */
require('dotenv').config({ quiet: true });
const dns = require('dns');
if (process.platform === 'win32') dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const { getCuratedImage, deriveSearchTerms } = require('../config/recipeImages');

const APPLY = process.argv.includes('--apply');

// כתובות שאנחנו יודעים שהן בעייתיות ויש להחליף
const isBrokenUrl = (url) => {
  if (!url) return true; // אין תמונה בכלל
  if (url.includes('loremflickr.com')) return true; // תמונה אקראית
  // קובץ מקור מלא בוויקימדיה (עד 5MB) - יש להחליף בגרסה ממוזערת
  if (/upload\.wikimedia\.org/.test(url) && !url.includes('/thumb/')) return true;
  if (url.startsWith('/uploads/')) return true; // קובץ מקומי שנמחק ב-Render
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) return true; // כתובת ישנה
  return false;
};

/**
 * האם יש לחשב מחדש את התמונה של מתכון AI.
 *
 * מתכונים שנוצרו ב-AI לפני התיקון עברו דרך `findStockPhoto('food')` - חיפוש
 * גנרי שמחזיר תמיד את אותה תוצאה ראשונה, בלי שום קשר לתוכן המתכון. לכן
 * כל תמונת TheMealDB על מתכון AI חשודה, ואם אפשר לגזור מונח מהכותרת
 * עדיף לחשב אותה מחדש.
 */
const shouldRefreshAiImage = (recipe) =>
  recipe.aiGenerated &&
  (recipe.imageUrl || '').includes('themealdb.com') &&
  deriveSearchTerms(recipe.title).length > 0;

async function findStockPhoto(term) {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.meals?.[0]?.strMealThumb || null;
}

/** מוצא תמונה מתאימה לשם מתכון: קודם המפה הקבועה, אחר כך גזירת מונח + TheMealDB */
async function resolveImage(title) {
  const curated = getCuratedImage(title);
  if (curated) return { url: curated, source: 'מפה קבועה' };

  for (const term of deriveSearchTerms(title)) {
    const photo = await findStockPhoto(term);
    if (photo) return { url: photo, source: `TheMealDB (${term})` };
  }

  return null;
}

/**
 * מתחבר למסד, עם נפילה חכמה כשפענוח SRV נכשל.
 *
 * הרקע: כתובות `mongodb+srv://` מחייבות שאילתת DNS מסוג SRV. חלק מהרשתות
 * (וגם סביבות מבודדות) חוסמות שאילתות DNS גולמיות, ואז `dns.resolveSrv`
 * נכשל ב-ETIMEOUT - למרות שפענוח שמות רגיל דרך מערכת ההפעלה עובד מצוין.
 *
 * במקרה כזה אנחנו פותרים את רשומות ה-SRV דרך DNS-over-HTTPS (שעובר בפורט
 * 443 הרגיל) ובונים כתובת `mongodb://` ישירה מול שרתי ה-shard.
 */
async function connectToDb() {
  const uri = process.env.MONGO_URI;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    return;
  } catch (err) {
    const isDnsFailure = /querySrv|ETIMEOUT|ECONNREFUSED|EAI_AGAIN/.test(err.message);
    if (!isDnsFailure || !uri.startsWith('mongodb+srv://')) throw err;
    console.warn('⚠️  פענוח SRV נכשל, עוקף דרך DNS-over-HTTPS...\n');
  }

  const clusterHost = (uri.match(/@([^/?]+)/) || [])[1];
  if (!clusterHost) throw new Error('לא הצלחתי לחלץ את כתובת הקלאסטר מ-MONGO_URI');

  const doh = async (name, type) => {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: 'application/dns-json' } }
    );
    if (!res.ok) throw new Error(`DoH נכשל: ${res.status}`);
    return ((await res.json()).Answer || []).map((a) => a.data);
  };

  const srv = await doh(`_mongodb._tcp.${clusterHost}`, 'SRV');
  const hosts = srv
    .map((rec) => rec.trim().split(/\s+/).pop().replace(/\.$/, ''))
    .filter(Boolean)
    .map((h) => `${h}:27017`);
  if (hosts.length === 0) throw new Error('לא נמצאו רשומות SRV');

  const txtOpts = (await doh(clusterHost, 'TXT')).join('&').replace(/"/g, '');

  // מרכיבים כתובת ישירה תוך שמירה על פרטי ההזדהות והנתיב המקוריים
  const [, creds, , pathAndQuery = ''] = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(.*)$/) || [];
  const [dbPath, originalQuery = ''] = pathAndQuery.split('?');
  const query = [txtOpts, originalQuery, 'ssl=true'].filter(Boolean).join('&');

  const directUri = `mongodb://${creds}@${hosts.join(',')}${dbPath || ''}?${query}`;
  console.log(`   מתחבר ישירות אל ${hosts.length} שרתי shard\n`);

  await mongoose.connect(directUri, { serverSelectionTimeoutMS: 20000 });
}

async function run() {
  await connectToDb();

  const recipes = await Recipe.find().select('title imageUrl aiGenerated').lean();
  console.log(`נבדקים ${recipes.length} מתכונים\n`);

  const plan = [];
  const skipped = [];
  const unresolved = [];

  for (const r of recipes) {
    if (!isBrokenUrl(r.imageUrl) && !shouldRefreshAiImage(r)) {
      skipped.push(r.title);
      continue;
    }

    const match = await resolveImage(r.title);
    // אין טעם לרשום "עדכון" שמחזיר בדיוק את אותה כתובת
    if (match && match.url === r.imageUrl) {
      skipped.push(r.title);
      continue;
    }
    if (match) {
      plan.push({ id: r._id, title: r.title, from: r.imageUrl, to: match.url, source: match.source });
    } else {
      unresolved.push(r.title);
    }
  }

  console.log(`✅ תקינים כבר (ללא שינוי): ${skipped.length}`);
  skipped.forEach((t) => console.log(`     ${t}`));

  console.log(`\n🔧 לעדכון: ${plan.length}`);
  plan.forEach((p) => {
    const fromLabel = p.from ? p.from.slice(0, 48) : '(ריק)';
    console.log(`     ${p.title}`);
    console.log(`        מ:  ${fromLabel}`);
    console.log(`        אל: ${p.to.slice(0, 70)}  [${p.source}]`);
  });

  if (unresolved.length > 0) {
    console.log(`\n⚠️  לא נמצאה תמונה תואמת (יישארו עם פלייסהולדר): ${unresolved.length}`);
    unresolved.forEach((t) => console.log(`     ${t}`));
    console.log('     (מכוון: עדיף פלייסהולדר נקי מאשר תמונה שלא קשורה למנה)');
  }

  if (!APPLY) {
    console.log('\n--- הרצה יבשה. להחלה בפועל: node scripts/fixRecipeImages.js --apply ---');
    await mongoose.disconnect();
    return;
  }

  for (const p of plan) {
    await Recipe.updateOne({ _id: p.id }, { $set: { imageUrl: p.to } });
  }
  console.log(`\n✅ עודכנו ${plan.length} מתכונים במסד.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
