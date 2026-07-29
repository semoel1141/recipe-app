// מוחק תמונות AI יתומות מתיקיית uploads.
// הרצה ידנית: node scripts/cleanupUploads.js
// בפרודקשן: כדאי להריץ פעם ביום (cron / scheduled job).
require('dotenv').config({ quiet: true });
const dns = require('dns');
dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const { cleanupOrphanedUploads } = require('../utils/cleanupUploads');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const { deleted, kept, freedBytes } = await cleanupOrphanedUploads();
  const freedMb = (freedBytes / 1024 / 1024).toFixed(2);

  console.log(`נמחקו ${deleted} קבצים יתומים (${freedMb} MB פונו), נשמרו ${kept}.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
