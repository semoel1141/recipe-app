const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// מסד נתונים אמיתי שרץ בזיכרון - הבדיקות לא נוגעות ב-Atlas
// ולא דורשות חיבור לאינטרנט.
let mongoServer;

async function connectTestDb() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
}

// מנקה את כל האוספים בין בדיקות, כך שכל בדיקה מתחילה ממצב ידוע
async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connectTestDb, closeTestDb, clearTestDb };
