const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const recipeRoutes = require('./routes/recipeRoutes');
const authRoutes = require('./routes/authRoutes');
const aiRecipeRoutes = require('./routes/aiRecipes');
const userRoutes = require('./routes/userRoutes');

/**
 * בונה את אפליקציית ה-Express בלי להאזין לפורט ובלי להתחבר למסד.
 *
 * ההפרדה מ-server.js היא מה שמאפשר לבדיקות (Supertest) להריץ בקשות
 * מול האפליקציה בזיכרון, בלי לפתוח פורט אמיתי ובלי להתחבר ל-Atlas.
 */
function createApp() {
  const app = express();

  // מאחורי proxy (Render/Railway/nginx) - נדרש כדי ש-req.protocol יחזיר https
  // וכדי ש-express-rate-limit יזהה את ה-IP האמיתי ולא את זה של ה-proxy
  app.set('trust proxy', 1);

  // helmet מוסיף כותרות אבטחה (HSTS, noSniff, frameguard ועוד).
  // crossOriginResourcePolicy מוגדר ל-cross-origin במפורש: ברירת המחדל של helmet
  // היא same-origin, וזה היה חוסם את הפרונטאנד (פורט 5173) מלטעון תמונות מ-/uploads (פורט 5000).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS מוגבל לרשימת דומיינים מותרת במקום פתוח לכולם.
  // CLIENT_URL ב-.env יכול להכיל כמה כתובות מופרדות בפסיק.
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // בקשות בלי Origin (Postman, curl, שרת-לשרת) מותרות
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error('Origin לא מורשה על ידי מדיניות ה-CORS'));
      },
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // מגיש תמונות שנוצרו ב-AI ונשמרו לדיסק (backend/uploads) בכתובת /uploads/<שם קובץ>
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.get('/', (req, res) => {
    res.send('Recipe App API is running...');
  });

  // ה-routes של ה-AI נרשמים לפני recipeRoutes כדי ש-/generate, /modify ו-/save
  // ייתפסו כמסלולים קבועים ולא יתנגשו עם מסלולים דינמיים כמו /:id
  app.use('/api/recipes', aiRecipeRoutes);
  app.use('/api/recipes', recipeRoutes);
  app.use('/api/auth', authRoutes);
  // ניהול משתמשים - כל הנתיבים בפנים מוגנים ב-protect + admin
  app.use('/api/users', userRoutes);

  // 404 בפורמט JSON - בלי זה Express מחזיר דף HTML שהלקוח לא יודע לפרסר
  app.use((req, res) => {
    res.status(404).json({ message: `הנתיב ${req.method} ${req.originalUrl} לא נמצא` });
  });

  // handler מרכזי לשגיאות - רשת ביטחון אחרונה לכל מה שלא נתפס ב-route עצמו
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    console.error('[server error]', err.message);
    const status = err.statusCode || 500;
    res.status(status).json({
      message: status === 500 ? 'שגיאת שרת פנימית' : err.message,
    });
  });

  return app;
}

module.exports = createApp;
