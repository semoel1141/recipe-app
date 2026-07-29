/**
 * מקדם משתמש קיים להרשאת אדמין (או מוריד אותו חזרה).
 *
 * הרצה:
 *   npm run make-admin -- someone@example.com          - הופך לאדמין
 *   npm run make-admin -- someone@example.com --demote - מחזיר להרשאת user
 *   npm run make-admin                                 - מציג את כל המשתמשים
 *
 * למה צריך סקריפט: האדמין הראשון במערכת חייב להיווצר מחוץ לממשק.
 * ההרשמה תמיד יוצרת משתמש עם role של 'user' (וכך צריך להיות - אחרת כל
 * אחד היה יכול להירשם כאדמין), ולניהול המשתמשים בממשק צריך כבר להיות אדמין.
 * זו בעיית "ביצה ותרנגולת" שנפתרת בגישה ישירה למסד.
 */
require('dotenv').config({ quiet: true });
const dns = require('dns');
if (process.platform === 'win32') dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const User = require('../models/User');

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const DEMOTE = args.includes('--demote');

/**
 * מתחבר למסד, עם נפילה ל-DNS-over-HTTPS כשפענוח SRV חסום ברשת.
 * (אותו מנגנון כמו ב-scripts/fixRecipeImages.js)
 */
async function connectToDb() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    return;
  } catch (err) {
    if (!/querySrv|ETIMEOUT|ECONNREFUSED|EAI_AGAIN/.test(err.message) || !uri.startsWith('mongodb+srv://')) {
      throw err;
    }
    console.warn('⚠️  פענוח SRV נכשל, עוקף דרך DNS-over-HTTPS...\n');
  }

  const clusterHost = (uri.match(/@([^/?]+)/) || [])[1];
  const doh = async (name, type) => {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
    });
    return ((await res.json()).Answer || []).map((a) => a.data);
  };

  const hosts = (await doh(`_mongodb._tcp.${clusterHost}`, 'SRV')).map(
    (rec) => `${rec.trim().split(/\s+/).pop().replace(/\.$/, '')}:27017`
  );
  const txtOpts = (await doh(clusterHost, 'TXT')).join('&').replace(/"/g, '');
  const [, creds, , pathAndQuery = ''] = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(.*)$/) || [];
  const [dbPath, originalQuery = ''] = pathAndQuery.split('?');
  const query = [txtOpts, originalQuery, 'ssl=true'].filter(Boolean).join('&');

  await mongoose.connect(`mongodb://${creds}@${hosts.join(',')}${dbPath || ''}?${query}`, {
    serverSelectionTimeoutMS: 20000,
  });
}

async function listUsers() {
  const users = await User.find().select('name email role').sort({ createdAt: -1 }).lean();
  console.log(`משתמשים במערכת (${users.length}):\n`);
  users.forEach((u) => {
    console.log(`  ${u.role === 'admin' ? '👑' : '  '} ${String(u.email).padEnd(30)} ${u.role}`);
  });
  console.log('\nלקידום:  npm run make-admin -- <email>');
}

async function run() {
  await connectToDb();

  if (!email) {
    await listUsers();
    await mongoose.disconnect();
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`❌ לא נמצא משתמש עם האימייל ${email}\n`);
    await listUsers();
    await mongoose.disconnect();
    process.exit(1);
  }

  const newRole = DEMOTE ? 'user' : 'admin';

  if (user.role === newRole) {
    console.log(`המשתמש ${user.email} כבר בהרשאת ${newRole} - אין מה לשנות.`);
    await mongoose.disconnect();
    return;
  }

  // מונע נעילה מוחלטת: אם זה האדמין האחרון, הורדה שלו משאירה מערכת בלי אדמין
  if (DEMOTE) {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      console.error('❌ זה האדמין האחרון במערכת. הורדה שלו תשאיר אותך בלי גישה לניהול.');
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  user.role = newRole;
  await user.save();

  console.log(`✅ ${user.email} → ${newRole}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
