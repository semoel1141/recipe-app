const mongoose = require('mongoose');
const dns = require('dns');

// workaround: ב-Windows ה-resolver המובנה של Node לפעמים נכשל בשאילתת DNS מסוג SRV
// (הנדרשת לכתובות mongodb+srv://) גם כשה-DNS הרגיל תקין - כפיית DNS של גוגל פותרת את זה.
//
// מוגבל ל-Windows בכוונה: בקונטיינר לינוקס (Render/Railway/Docker) ה-DNS הפנימי
// עובד תקין, וכפיית 8.8.8.8 רק מוסיפה נקודת כשל - היא שוברת רזולוציה של שמות
// פנימיים ונכשלת לגמרי בסביבות שחוסמות UDP/53 החוצה.
if (process.platform === 'win32') {
  dns.setServers(['8.8.8.8']);
}

// פונקציה שמתחברת ל-MongoDB Atlas לפי הכתובת שב-.env
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1); // עוצר את השרת אם אין חיבור למסד - אין טעם להמשיך בלעדיו
  }
};

module.exports = connectDB;
