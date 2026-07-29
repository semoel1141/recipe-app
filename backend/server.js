require('dotenv').config({ quiet: true });
const validateEnv = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');

// נכשל מהר עם הודעה ברורה אם חסר MONGO_URI / JWT_SECRET (H9)
validateEnv();

connectDB();

// בניית האפליקציה עצמה נמצאת ב-app.js, כדי שהבדיקות יוכלו להריץ אותה
// בלי לפתוח פורט ובלי להתחבר ל-Atlas
const app = createApp();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
