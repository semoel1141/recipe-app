# תיעוד טכני — Backend (Recipe App API)

> גרסה: תואם למצב הקוד לאחר סבב הביקורת המתועד ב-`todo_and_fixes.md` (35/35 ממצאים טופלו) + חיזוק נוסף ל-`PUT /api/recipes/:id` (חסימת mass-assignment על `_id`/`createdAt`/`updatedAt`/`__v`).
> סטאק: Node.js · Express 5 · Mongoose 9 (MongoDB Atlas) · JWT · bcryptjs · Google Gemini (`@google/genai`) · Vitest + Supertest + mongodb-memory-server.

## תוכן עניינים

1. [ארכיטקטורה כללית](#ארכיטקטורה-כללית)
2. [נקודת כניסה: `server.js` ו-`app.js`](#נקודת-כניסה)
3. [תצורה: `config/`](#תצורה-config)
4. [מודלים: `models/`](#מודלים-models)
5. [Middleware: `middleware/`](#middleware)
6. [ראוטים: `routes/`](#ראוטים-routes)
7. [כלי עזר: `utils/`](#כלי-עזר-utils)
8. [סקריפטים: `scripts/`](#סקריפטים-scripts)
9. [בדיקות: `tests/`](#בדיקות-tests)
10. [קבצי תצורה כלליים](#קבצי-תצורה-כלליים)
11. [מפת תלויות מלאה (Dependency Graph)](#מפת-תלויות-מלאה)

---

## ארכיטקטורה כללית

```
backend/
├── server.js              # נקודת כניסה - מאזין לפורט, מתחבר ל-DB
├── app.js                 # בניית אפליקציית Express (ללא listen/connect)
├── config/
│   ├── db.js               # חיבור Mongoose ל-Atlas
│   ├── env.js               # ולידציית משתני סביבה בעליה
│   └── gemini.js             # לקוח Google Gemini + פרומפטים
├── middleware/
│   ├── auth.js               # protect / optionalAuth / admin
│   └── rateLimit.js           # מגבלות קצב לפי IP
├── models/
│   ├── User.js                # סכמת משתמש + הצפנת סיסמה
│   └── Recipe.js               # סכמת מתכון
├── routes/
│   ├── authRoutes.js            # /api/auth/*
│   ├── recipeRoutes.js           # /api/recipes (CRUD רגיל)
│   └── aiRecipes.js              # /api/recipes/generate|modify|generate-image|save
├── utils/
│   ├── generateToken.js          # יצירת JWT
│   └── cleanupUploads.js          # ניקוי תמונות AI יתומות
├── scripts/                # סקריפטים חד-פעמיים/תחזוקתיים, מורצים ידנית עם node
└── tests/                  # Vitest + Supertest + MongoMemoryServer
```

**זרימת בקשה טיפוסית** (לדוגמה `POST /api/recipes`):

`server.js` מקשיב על הפורט → מעביר ל-`app.js` (Express) → עובר דרך `helmet` → `cors` → `express.json` → מגיע ל-router הרלוונטי (`routes/recipeRoutes.js`) → עובר דרך `middleware/auth.js` (`protect`) שמאמת JWT ומצמיד `req.user` → ה-route handler קורא ל-`models/Recipe.js` (Mongoose) → Mongoose שולח שאילתה ל-MongoDB Atlas → תשובה חוזרת כ-JSON, או שגיאה נתפסת ומטופלת ב-error handler המרכזי שב-`app.js`.

**עקרון מפתח בקוד:** בכל route שיוצר/מעדכן משאב בבעלות משתמש (`owner`), הבעלים תמיד נלקח מ-`req.user._id` (שמגיע מהטוקן המאומת) ולעולם לא מגוף הבקשה — זה מונע התחזות והשתלטות על משאבים של משתמשים אחרים.

---

## נקודת כניסה

### `server.js`

**מה הקובץ עושה בפועל:**
נקודת ההרצה האמיתית של השרת. טוען משתני סביבה מ-`.env`, מריץ ולידציה שלהם, פותח חיבור ל-MongoDB, בונה את אובייקט ה-Express App ומתחיל להאזין על פורט (`process.env.PORT` או `5000` כברירת מחדל).

**תלוי ב (dependencies):**
- `dotenv` (חבילת npm) — טוען את `backend/.env` לתוך `process.env`.
- `./config/env` (`validateEnv`) — בודק ש-`MONGO_URI` ו-`JWT_SECRET` קיימים; אם לא — מדפיס שגיאה ויוצא (`process.exit(1)`).
- `./config/db` (`connectDB`) — פותח את החיבור בפועל ל-Atlas.
- `./app` (`createApp`) — הפונקציה שבונה את אובייקט Express (routes, middleware, error handling) בלי לפתוח פורט.

**מי תלוי בו:** אף קובץ קוד לא תלוי ב-`server.js` (הוא עלה עצמו של גרף התלויות) — הוא רק מופעל ישירות דרך `npm start` / `npm run dev` (nodemon).

**תוצאה בפועל:** זהו התהליך שרץ בפרודקשן/בפיתוח. בלעדיו האפליקציה לא מאזינה לבקשות HTTP כלל. ההפרדה המכוונת בין `server.js` (יש listen+DB) לבין `app.js` (אין) היא מה שמאפשר לקבצי הבדיקות ב-`tests/` להריץ בקשות Supertest נגד ה-app בזיכרון, בלי לפתוח פורט אמיתי ובלי תלות ברשת/Atlas.

---

### `app.js`

**מה הקובץ עושה בפועל:**
מייצא פונקציה יחידה, `createApp()`, שבכל קריאה בונה ומחזירה מופע Express חדש ומוגדר במלואו: middleware גלובלי (אבטחה, CORS, פרסור JSON), הגשת קבצים סטטיים, רישום כל ה-routers, ו-handlers של 404 ושגיאות. לא פותח פורט ולא מתחבר למסד — זו אחריות של `server.js`.

**תלוי ב (dependencies):**
- `express`, `path`, `cors`, `helmet` (חבילות npm).
- `./routes/recipeRoutes`, `./routes/authRoutes`, `./routes/aiRecipes` — שלושת ה-routers שנרשמים על ה-app.

**מי תלוי בו:**
- `server.js` — קורא ל-`createApp()` ואז `app.listen(...)`.
- `tests/auth.test.js` ו-`tests/recipes.test.js` — קוראים ל-`createApp()` ומריצים נגדו בקשות Supertest ישירות, בלי שרת אמיתי.

**תוצאה בפועל ומה שנקבע כאן:**
- `app.set('trust proxy', 1)` — נדרש מאחורי proxy (Render/Railway/nginx) כדי ש-`req.protocol` יזהה `https` נכון וכדי ש-`express-rate-limit` יזהה את כתובת ה-IP האמיתית של הלקוח ולא את זו של ה-proxy.
- `helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })` — מוסיף כותרות אבטחה (HSTS, `X-Content-Type-Options`, frameguard וכו'). המדיניות `cross-origin` נדרשת במפורש כי ברירת המחדל של helmet (`same-origin`) הייתה חוסמת את הפרונטאנד (למשל פורט 5173) מלטעון תמונות מ-`/uploads` (פורט 5000 — origin טכנית שונה).
- CORS מוגבל לרשימת דומיינים מ-`CLIENT_URL` (מחרוזת מופרדת בפסיקים; ברירת מחדל `http://localhost:5173,http://localhost:5174`) במקום CORS פתוח לחלוטין. בקשות בלי `Origin` header (Postman, curl, קריאות שרת-לשרת) מותרות תמיד.
- `express.json({ limit: '1mb' })` — מגביל את גודל ה-body כדי למנוע ניצול לרעה (לא רלוונטי להעלאת תמונות בפועל, כי אלו נוצרות בצד השרת ולא מועלות מהלקוח).
- `express.static(path.join(__dirname, 'uploads'))` מורכב על `/uploads` — מגיש את קבצי התמונות שנוצרו ב-AI (ראו `routes/aiRecipes.js`) ישירות מהדיסק.
- **סדר הרישום קריטי:** `aiRecipeRoutes` נרשם *לפני* `recipeRoutes` על אותו prefix (`/api/recipes`). הסיבה: ל-`recipeRoutes` יש route דינמי `GET /:id`, שהיה "בולע" בקשות ל-`/api/recipes/generate` (מתפרש כ-`id = "generate"`) אם נרשם ראשון.
- 404 handler מרכזי מחזיר JSON (`{ message: ... }`) ולא HTML — כדי שהלקוח (axios) תמיד יוכל לפרסר את התשובה.
- Error handler מרכזי (4 פרמטרים) הוא רשת הביטחון האחרונה: תופס כל שגיאה שלא טופלה ב-route עצמו, מדפיס ל-console, ומחזיר `500` גנרי (או `err.statusCode` אם הוגדר) כדי לא לדלוף פרטי מימוש (stack trace וכו') ללקוח.

---

## תצורה (`config/`)

### `config/db.js`

**מה עושה:** מייצא פונקציית `connectDB()` יחידה שמתחברת ל-MongoDB Atlas דרך Mongoose, לפי `process.env.MONGO_URI`.

**תלוי ב:** `mongoose`, `dns` (מודול built-in של Node), ומשתנה הסביבה `MONGO_URI`.

**מי תלוי בו:** `server.js` (בהרצה רגילה). **לא** בשימוש בבדיקות — `tests/setup.js` מתחבר בעצמו ל-`MongoMemoryServer` במקום זאת, כדי שהבדיקות לא ייגעו ב-Atlas האמיתי.

**תוצאה בפועל:**
- `dns.setServers(['8.8.8.8'])` — עוקף באג ידוע ב-Windows שבו ה-DNS resolver המובנה של Node נכשל בשאילתות מסוג SRV (נדרשות לכתובות `mongodb+srv://`) גם כשה-DNS הרגיל תקין. בלי זה החיבור עלול להיכשל רק במחשבי פיתוח מסוימים בצורה בלתי צפויה.
- אם החיבור נכשל (`MONGO_URI` שגוי, אין רשת, IP לא ברשימה הלבנה ב-Atlas) — מדפיס שגיאה ומריץ `process.exit(1)`. זו החלטה מכוונת: שרת בלי חיבור למסד לא שימושי, ועדיף כישלון מיידי וברור על פני שרת "חי" שכל בקשה אליו נכשלת.

### `config/env.js`

**מה עושה:** מייצא `validateEnv()` שרצה פעם אחת, מוקדם ב-`server.js`, ובודקת שמשתני הסביבה החיוניים (`MONGO_URI`, `JWT_SECRET`) קיימים לפני שהשרת ממשיך לעלות.

**תלוי ב:** `process.env` בלבד (אין תלויות npm).

**מי תלוי בו:** `server.js` בלבד.

**תוצאה בפועל:** אם חסר `MONGO_URI` או `JWT_SECRET` — מדפיס רשימת המשתנים החסרים ומפנה ל-`.env.example`, ואז `process.exit(1)`. זהו תיקון לממצא H9 המקורי: בלי הבדיקה הזו, שרת בלי `JWT_SECRET` היה עולה "בהצלחה" לכאורה, ורק בהתחברות ראשונה של משתמש היה נכשל ב-500 מסתורי (כי `jwt.sign(..., undefined, ...)` זורק שגיאה) — קשה מאוד לאבחן בפרודקשן. כמו כן: מזהיר (לא חוסם) אם `JWT_SECRET` קצר מ-32 תווים (סוד קצר מדי ניתן לפיצוח בכוח גס), ומזהיר אם `GEMINI_API_KEY` חסר (נתיבי ה-AI יחזירו 503 אך שאר האפליקציה תעבוד כרגיל).

### `config/gemini.js`

**מה עושה:** עוטף את ה-SDK הרשמי של Google (`@google/genai`) ומספק שלוש פונקציות עסקיות: יצירת מתכון JSON לפי פרומפט חופשי, יצירת תמונת מזון, והצעת מונח חיפוש קצר באנגלית לתמונת גיבוי.

**תלוי ב:** `@google/genai` (npm), משתנה הסביבה `GEMINI_API_KEY`.

**מי תלוי בו:** `routes/aiRecipes.js` בלבד — כל שלוש הפונקציות המיוצאות (`generateRecipeJson`, `generateRecipeImage`, `suggestImageSearchTerm`) נצרכות שם.

**תוצאה בפועל ונקודות טכניות מרכזיות:**
- `getClient()` יוצר את מופע ה-`GoogleGenAI` **בעצלנות** (lazy) — רק בפעם הראשונה שבאמת צריך לקרוא ל-AI, ולא בזמן טעינת הקובץ. כך השרת עולה תקין גם בלי `GEMINI_API_KEY` מוגדר; רק קריאה בפועל לנתיב AI תיכשל עם שגיאת `503` ברורה.
- `RECIPE_SCHEMA` הוא סכימת JSON שנאכפת ברמת ה-API של Gemini עצמו (`responseSchema`) ולא רק "מבוקשת" בטקסט הפרומפט — כלומר הספק מבטיח שהתשובה תואמת למבנה (שדות חובה, טיפוסים), מה שמייתר ניקוי טקסט חופשי (כמו הסרת ` ```json `) ומונע שדות חסרים/עודפים.
- `generateRecipeImage` מבקש `responseModalities: [Modality.IMAGE]` ומחלץ `inlineData` (base64) מהתשובה; שגיאות (אין quota, אין billing) עולות עם `error.statusCode` שמותאם ב-`routes/aiRecipes.js` להחזרת קוד HTTP מתאים ללקוח.
- הקובץ מתעד במפורש (בהערות) שיצירת תמונות אינה כלולה ב-tier החינמי של Gemini, ושמודלים ישנים (כמו `gemini-2.5-flash`) עלולים להפסיק להיות זמינים למפתחות חדשים ולהחזיר 404 — נקודת תחזוקה חשובה למי שמפעיל את הפרויקט עם מפתח API חדש.

---

## מודלים (`models/`)

### `models/User.js`

**מה עושה:** מגדיר את סכמת Mongoose למשתמש: `name`, `email` (ייחודי, מאומת בפורמט, lowercase אוטומטי), `password` (מוצפן, לא מוחזר כברירת מחדל), `role` (`user`/`admin`).

**תלוי ב:** `mongoose`, `bcryptjs`.

**מי תלוי בו:**
- `middleware/auth.js` — `protect`/`optionalAuth` משתמשים ב-`User.findById` כדי לאמת שהמשתמש שבטוקן עדיין קיים.
- `routes/authRoutes.js` — הרשמה (`User.create`), התחברות (`User.findOne` + `comparePassword`), `/me`.
- `routes/recipeRoutes.js`, `routes/aiRecipes.js` — לא משתמשים ב-`User` ישירות, אך מסתמכים על `req.user` שה-middleware מצמיד.
- `scripts/seedRecipes.js` — שולף משתמש קיים כדי לשייך אליו מתכוני seed.

**תוצאה בפועל:**
- `userSchema.pre('save', ...)` — hook שרץ אוטומטית לפני כל שמירה; אם השדה `password` השתנה, מצפין אותו מחדש עם `bcrypt` (10 סבבי salt). הבדיקה `this.isModified('password')` מונעת הצפנה כפולה כשמעדכנים שדה אחר (כמו שם) בלבד.
- `select: false` על `password` — אף שאילתת `find`/`findOne` רגילה לא תחזיר את השדה בטעות (למשל אם מישהו ישכח `.select('-password')` במקום אחר בקוד); צריך לבקש אותו במפורש עם `.select('+password')`, כפי שנעשה רק בלוגין.
- `comparePassword` — method על כל מסמך משתמש; עוטף `bcrypt.compare` להשוואת סיסמה גלויה מול ההאש השמור.
- אינדקס ייחודי אוטומטי על `email` (מ-`unique: true`) — מונע ברמת ה-DB (לא רק ברמת האפליקציה) שני משתמשים עם אותו אימייל, גם בתנאי מירוץ (race condition) של שתי הרשמות בו-זמנית.

### `models/Recipe.js`

**מה עושה:** מגדיר את סכמת המתכון: `title`, `description`, `ingredients` (מערך, לפחות פריט אחד), `instructions` (מחרוזת אחת עם `\n` בין שלבים), `prepTime`, `servings`, `imageUrl`, `aiGenerated`, ו-`owner` (הפניה ל-`User`).

**תלוי ב:** `mongoose` בלבד.

**מי תלוי בו:** `routes/recipeRoutes.js` (כל ה-CRUD), `routes/aiRecipes.js` (route `/save`), `utils/cleanupUploads.js` (שולף אילו תמונות עדיין בשימוש), `scripts/seedRecipes.js` ו-`scripts/updateRecipeImages.js`.

**תוצאה בפועל והחלטות עיצוב מתועדות:**
- `instructions` נשמר כ-**מחרוזת** ולא כמערך שלבים, במכוון: ה-AI מחזיר מערך, וה-route ממיר אותו ל-`\n` לפני השמירה; הלקוח מפצל בחזרה לרשימה ממוספרת בתצוגה. ההחלטה נשמרה כך כדי לא לשבור נתונים/טפסים קיימים שנכתבו כשהשדה היה מחרוזת חופשית.
- ולידציה מותאמת אישית (`validate`) על `ingredients` מוודאת שזה מערך לא ריק — לא מספיק לסמן `required` על מערך, כי מערך ריק `[]` נחשב "קיים" מבחינת Mongoose.
- `timestamps: true` מוסיף `createdAt`/`updatedAt` אוטומטית.
- שני אינדקסים מוגדרים בכוונה רבה: `createdAt: -1` (למיון "החדש ביותר" שמשמש כל שליפת רשימה) ו-`owner: 1, createdAt: -1` (מרוכב, לעמוד "המתכונים שלי"). **לא** הוגדר text index לחיפוש — החלטה מתועדת: החיפוש באתר הוא "תוך כדי הקלדה" עם התאמה חלקית (regex), ו-text index של Mongo מתאים רק להתאמת מילים שלמות ולכן היה פוגע בחוויית החיפוש הקיימת ולא תורם. לנפחים גדולים יותר, הפתרון המומלץ (המתועד כהערה) הוא Atlas Search עם autocomplete.

---

## Middleware

### `middleware/auth.js`

**מה עושה:** מייצא שלושה middleware-ים: `protect` (חוסם גישה בלי טוקן תקין), `optionalAuth` (מזהה משתמש מחובר אם יש, אך לא חוסם אם אין), ו-`admin` (דורש `role === 'admin'`, לשימוש אחרי `protect`).

**תלוי ב:** `jsonwebtoken`, `models/User`.

**מי תלוי בו:**
- `routes/recipeRoutes.js` — `protect` על POST/PUT/DELETE, `optionalAuth` על GET (לתמיכה ב-`?mine=true`).
- `routes/authRoutes.js` — `protect` על `GET /me`.
- `routes/aiRecipes.js` — `protect` על `/save` בלבד (`/generate`, `/modify`, `/generate-image` פתוחים בכוונה, ומוגנים ב-rate limiting במקום).

**תוצאה בפועל:**
- `protect` קורא ל-`Authorization: Bearer <token>` header, מפענח עם `jwt.verify(token, process.env.JWT_SECRET)`, ואז שולף את המשתמש בפועל מה-DB (`User.findById`) ומצמיד אותו ל-`req.user`. **חשוב:** גם אם הטוקן תקין קריפטוגרפית, אם המשתמש נמחק מה-DB בינתיים — הבקשה נדחית ב-401 ("המשתמש ששייך לטוקן זה כבר לא קיים"), ולא ממשיכה עם משתמש "רפאים".
- `optionalAuth` זהה בעיקרון, אבל בולעת (`catch`) כל שגיאת פענוח או העדר header, וממשיכה הלאה עם `req.user === undefined`. זה מאפשר ל-`GET /api/recipes` להתנהג אחרת למשתמש מחובר (`?mine=true`) מבלי לחסום גישה אנונימית לרשימה הרגילה.
- `admin` מניח ש-`protect` כבר רץ קודם ומילא את `req.user`; אם לא — `req.user` יהיה `undefined` וה-middleware יחזיר 403 בבטחה (בלי לקרוס), בזכות ה-optional chaining (`req.user?.role`).

### `middleware/rateLimit.js`

**מה עושה:** מגדיר שלושה limiter-ים מבוססי-IP באמצעות `express-rate-limit`: `aiTextLimiter` (20 בקשות / 15 דקות), `aiImageLimiter` (15 בקשות / שעה), ו-`authLimiter` (30 ניסיונות / 15 דקות, סופר רק ניסיונות כושלים).

**תלוי ב:** `express-rate-limit` (npm).

**מי תלוי בו:** `routes/aiRecipes.js` (שני ה-AI limiters, על `/generate`, `/modify`, `/generate-image`), `routes/authRoutes.js` (`authLimiter` על `/register` ו-`/login`).

**תוצאה בפועל:** סוגר את ממצא C1: בלי הגבלות אלו, נתיבי ה-AI (שפתוחים במכוון גם למשתמש לא מחובר, כדי לתת "טעימה" של הפיצ'ר) היו חשופים לכל אדם באינטרנט לשריפת מכסת Gemini וניפוח דיסק השרת בתמונות. `authLimiter` עם `skipSuccessfulRequests: true` מקשה במיוחד על ניחוש סיסמאות בכוח גס בלי להעניש משתמשים לגיטימיים שמתחברים בהצלחה שוב ושוב. תלוי ב-`app.set('trust proxy', 1)` שהוגדר ב-`app.js` כדי לזהות נכון את כתובת ה-IP האמיתית מאחורי proxy.

---

## ראוטים (`routes/`)

### `routes/authRoutes.js`

**מה עושה:** חושף שלושה endpoints: `POST /register`, `POST /login`, `GET /me`.

**תלוי ב:** `models/User`, `utils/generateToken`, `middleware/auth` (`protect`), `middleware/rateLimit` (`authLimiter`).

**מי תלוי בו:** נרשם ב-`app.js` תחת `/api/auth`. נצרך ישירות בקוד הלקוח דרך `frontend/src/context/AuthContext.jsx` (`/auth/login`, `/auth/register`) ו-`Navbar`/`PrivateRoute` בעקיפין דרך ה-context.

**תוצאה בפועל ונקודות אבטחה מרכזיות:**
- `readCredentials()` — פונקציית עזר מקומית שמוודאת שכל שדה קלט הוא **מחרוזת** ממש (`typeof === 'string'`) לפני שהוא נכנס לשאילתת Mongo. זהו התיקון לממצא C7 (NoSQL injection): בלי הבדיקה, שליחת `{"email": {"$gt": ""}}` הייתה גורמת ל-Mongoose להתייחס לאובייקט כאופרטור שאילתה ולהחזיר את המשתמש הראשון באוסף.
- הודעת שגיאה **זהה** לכל כישלון התחברות ("אימייל או סיסמה שגויים") — בין אם האימייל לא קיים, הסיסמה שגויה, או שהקלט לא תקין מבנית — כדי לא לחשוף למתקיף אילו כתובות אימייל רשומות במערכת.
- `POST /register` יוצר משתמש (עם הצפנת סיסמה אוטומטית דרך ה-`pre('save')` hook במודל) ומחזיר מיד טוקן — המשתמש מחובר אוטומטית לאחר הרשמה.
- `POST /login` שולף במפורש את שדה ה-`password` (`.select('+password')`, כי הוא `select: false` בסכמה) כדי להשוות אותו.
- שני ה-endpoints מוגנים ב-`authLimiter` מפני ניסיונות מרובים.

### `routes/recipeRoutes.js`

**מה עושה:** מממש CRUD מלא למתכונים: `GET /` (רשימה עם חיפוש/סינון/עימוד), `GET /:id` (בודד), `POST /` (יצירה), `PUT /:id` (עדכון), `DELETE /:id` (מחיקה).

**תלוי ב:** `models/Recipe`, `middleware/auth` (`protect`, `optionalAuth`).

**מי תלוי בו:** נרשם ב-`app.js` תחת `/api/recipes` (**אחרי** `aiRecipeRoutes` על אותו prefix). נצרך על ידי `frontend/src/hooks/useRecipeList.js`, `frontend/src/pages/RecipeDetail.jsx`, `frontend/src/pages/RecipeForm.jsx`.

**תוצאה בפועל, endpoint-אחר-endpoint:**
- **`GET /`** — בונה `filter` דינמי: `search` (חיפוש טקסט חופשי, עם בריחה ידנית מתווי regex מיוחדים כדי שקלט כמו `.*` לא ייצור ביטוי רגולרי "תפוס הכל") שמחפש גם ב-`title` וגם ב-`ingredients`; ו-`mine=true` שמסנן לפי `owner` — אך ורק לפי `req.user._id` שמגיע מהטוקן המאומת דרך `optionalAuth` (ולא לפי פרמטר בכתובת), כדי שאף אחד לא יוכל לבקש את המתכונים של משתמש אחר. תומך בעימוד אמיתי (`page`/`limit`, עם `MAX_LIMIT=48` ו-`DEFAULT_LIMIT=12` כדי למנוע שליפה בלתי מוגבלת). מחזיר אובייקט עטוף (`{ recipes, page, pages, total }`) ולא מערך גולמי, כדי לאפשר הרחבה עתידית בלי לשבור פורמט. משתמש ב-`.select(...)` כדי להחזיר רק את השדות הדרושים לתצוגת רשימה (לא את כל ה-`instructions`/`ingredients` המלאים של כל מתכון) — חיסכון משמעותי ברוחב פס.
- **`GET /:id`** — פתוח לכולם (גם לא מחוברים), עם `populate('owner', 'name')` כדי להציג "נוצר ע"י X". מטפל ב-`CastError` (מזהה לא בפורמט ObjectId תקין) כ-400 במקום 500 גנרי.
- **`POST /`** — מוגן ב-`protect`; `owner` נקבע **תמיד** מ-`req.user._id`, גם אם הלקוח שולח `owner` אחר ב-body (spread `...req.body` נדרס על ידי `owner: req.user._id` שבא אחריו באובייקט).
- **`PUT /:id`** — מוגן ב-`protect` + בדיקת הרשאה מפורשת: רק הבעלים (`recipe.owner.toString() === req.user._id.toString()`) או אדמין (`req.user.role === 'admin'`) יכולים לערוך; אחרת 403. לפני החלת השינויים (`Object.assign(recipe, req.body)`), מוחקים מ-`req.body` את השדות `owner`, `_id`, `createdAt`, `updatedAt`, `__v` — מונע מהלקוח לגנוב בעלות על מתכון, לזייף את תאריך היצירה (ולעקוף את מיון "החדש ביותר"), או לנסות לשנות את מזהה/גרסת המסמך.
- **`DELETE /:id`** — אותה בדיקת הרשאה בדיוק כמו PUT.
- כל ה-handlers עוטפים שגיאות Mongoose סטנדרטיות: `ValidationError` → 400 (שדה חובה חסר/לא תקין), `CastError` → 400 (מזהה לא תקין), כל השאר → 500.

### `routes/aiRecipes.js`

**מה עושה:** מממש את פיצ'ר יצירת המתכונים בעזרת AI: `POST /generate` (מתכון חדש מפרומפט חופשי), `POST /modify` (עדכון מתכון קיים לפי בקשה בשפה טבעית), `POST /generate-image` (תמונת מזון, עם נפילה לתצלום אמיתי), `POST /save` (שמירת המתכון הסופי כ-Recipe אמיתי במסד).

**תלוי ב:** `fs/promises`, `path`, `crypto` (built-in), `models/Recipe`, `middleware/auth` (`protect`), `middleware/rateLimit` (`aiTextLimiter`, `aiImageLimiter`), `config/gemini` (שלוש הפונקציות המיוצאות משם).

**מי תלוי בו:** נרשם ב-`app.js` תחת `/api/recipes`, **לפני** `recipeRoutes` (כדי ש-`/:id` הדינמי לא יבלע את `/generate` וכו'). נצרך על ידי `frontend/src/components/AiRecipeManager.jsx`.

**תוצאה בפועל ונקודות עיצוב מרכזיות:**
- `asyncHandler` — wrapper גנרי שהופך כל שגיאה בפונקציה אסינכרונית לקריאת `next(err)`, במקום לחזור על אותו `try/catch` בכל route בקובץ.
- `validateRecipeShape()` — ולידציה ידנית על אובייקט מתכון שמגיע **מהלקוח** (ב-`/modify` וב-`/save`): אסור לסמוך על כך שהלקוח שולח בדיוק את מה שה-AI החזיר במקור (יכול להיות ששונה בצד הלקוח, או שנשלח ידנית).
- **`/generate`**: מגביל את אורך הפרומפט ל-500 תווים (מניעת שימוש לרעה/עלות מיותרת), בונה פרומפט מובנה ומעביר ל-`generateRecipeJson`.
- **`/modify`**: שולח ל-AI רק את השדות הרלוונטיים של המתכון הקיים (לא את כל האובייקט מהלקוח — למשל בלי `_id`/`owner` אם הגיעו) יחד עם בקשת השינוי, ומצפה למתכון מלא בחזרה.
- **`/generate-image`**: מסלול ראשי — יצירת תמונה אמיתית ב-Gemini, נשמרת לדיסק תחת `backend/uploads/<uuid>.<ext>` (שם קובץ אקראי עם `crypto.randomUUID()` — מונע התנגשויות ו-path traversal). **מחזיר נתיב יחסי בלבד** (`/uploads/<file>`), לא כתובת מלאה — זהו תיקון C4: כתובת מלאה עם `localhost` הייתה נשמרת קבוע במסד ונשברת ברגע שהשרת עובר לדומיין אמיתי. אם יצירת התמונה נכשלת (בד"כ בגלל שיצירת תמונות ב-Gemini דורשת billing מופעל) — נופל בשקט למסלול גיבוי: מבקש מ-AI מונח חיפוש קצר באנגלית ומחפש תצלום אמיתי דרך TheMealDB (API ציבורי חינמי). כך למתכון תמיד יש תמונה, גם בלי הרשאת יצירת-תמונות.
- **`/save`**: מוגן ב-`protect` — רק משתמש מחובר יכול לשמור מתכון AI לצמיתות. ממיר `instructions` ממערך שלבים (איך שה-AI מחזיר) למחרוזת עם `\n` (הפורמט הנשמר ב-DB, תואם ל-`models/Recipe.js`). מסמן `aiGenerated: true` אוטומטית.
- error handler ייעודי בתחתית הקובץ (נפרד מזה שב-`app.js`) — ממיר שגיאות `statusCode` שמגיעות מ-`config/gemini.js` (503 חוסר מפתח, 502 תשובה לא תקינה) לקוד HTTP המתאים, ומחביא הודעות שגיאה פנימיות (500) מאחורי טקסט גנרי.

---

## כלי עזר (`utils/`)

### `utils/generateToken.js`

**מה עושה:** פונקציה אחת, `generateToken(userId)`, שיוצרת JWT חתום עם תוקף 30 יום, מכיל רק `{ id: userId }`.

**תלוי ב:** `jsonwebtoken`, `process.env.JWT_SECRET`.

**מי תלוי בו:** `routes/authRoutes.js` בלבד (בהרשמה ובהתחברות).

**תוצאה בפועל:** הטוקן הזה הוא מנגנון האימות היחיד באפליקציה — כל בקשה מוגנת (`protect`) מפענחת אותו כדי לדעת "מי מבצע את הבקשה" (`decoded.id` → `User.findById`).

### `utils/cleanupUploads.js`

**מה עושה:** מייצא `cleanupOrphanedUploads()` שסורקת את תיקיית `backend/uploads`, ומוחקת קבצי תמונה שאינם מקושרים לאף מתכון קיים ב-DB, **ו**שעברו "תקופת חסד" של 6 שעות מאז יצירתם.

**תלוי ב:** `fs/promises`, `path` (built-in), `models/Recipe`.

**מי תלוי בו:** `scripts/cleanupUploads.js` (הרצה ידנית/מתוזמנת).

**תוצאה בפועל:** פותר את ממצא M9 — `/generate-image` כותב קובץ לדיסק בכל פעם שמישהו מייצר תמונה, גם אם המתכון מעולם לא נשמר, או שהמשתמש לחץ "תמונה אחרת" כמה פעמים ברצף. בלי ניקוי, `uploads/` היה גדל ללא גבול. תקופת החסד של 6 שעות מונעת מחיקה של תמונה ש"בדרך" להישמר (המשתמש עדיין עורך את המתכון AI לפני לחיצה על שמור). מחזירה סטטיסטיקה (`deleted`, `kept`, `freedBytes`) לצורך לוגים.

---

## סקריפטים (`scripts/`)

כל הקבצים בתיקייה זו הם **כלי CLI חד-פעמיים/תחזוקתיים**, מורצים ידנית עם `node scripts/<file>.js` (לא נטענים אוטומטית ע"י השרת, ולא חלק מבקשת HTTP כלשהי).

### `scripts/seedRecipes.js`
מזרים 18 מתכונים אמיתיים (בעברית, עם תמונות מ-LoremFlickr) ל-DB, משויכים למשתמש קיים ראשון שנמצא (`User.findOne()`). "אידמפוטנטי" חלקית: אם מתכון עם אותו `title` כבר קיים, מעדכן רק את התמונה שלו במקום ליצור כפילות. **תלוי ב:** `mongoose`, `models/Recipe`, `models/User`, `MONGO_URI`. דורש שכבר קיים לפחות משתמש רשום אחד (אחרת יוצא עם שגיאה).

### `scripts/updateRecipeImages.js`
מעדכן את התמונות של המתכונים הקיימים בפועל בתמונות איכותיות יותר מ-TheMealDB, לפי מיפוי ידני (`SEARCH_TERMS`) בין שם המתכון בעברית למונח חיפוש באנגלית. **תלוי ב:** `mongoose`, `models/Recipe`, `MONGO_URI`.

### `scripts/cleanupUploads.js`
עוטף קריאה יחידה ל-`utils/cleanupUploads.js` (`cleanupOrphanedUploads`) עם חיבור/ניתוק DB, ומדפיס תוצאה קריאה לאדם. מיועד להרצה תקופתית (cron יומי) בפרודקשן.

### `scripts/testAiFlow.js`
בדיקת עשן (smoke test) ידנית מקצה לקצה מול שרת **שכבר רץ** (על `http://127.0.0.1:5000`, לא `localhost` — כדי לעקוף העדפת IPv6 בפונקציית ה-`fetch` המובנית של Node, שגורמת ל-"fetch failed" מבלבל מול שרת שמאזין רק על IPv4). מריץ `generate` → `modify` → מוודא ש-`save` בלי טוקן נכשל ב-401 כמצופה. **הערה:** זהו סקריפט אבחון ידני, ולא חלק מ-`npm test` (זה תפקידם של קבצי `tests/`).

כל שלושת סקריפטי ה-DB (`seedRecipes`, `updateRecipeImages`, `cleanupUploads`) חוזרים על אותו workaround מ-`config/db.js` — `dns.setServers(['8.8.8.8'])` — כי הם מתחברים ל-Atlas ישירות ולא דרך `connectDB()`.

---

## בדיקות (`tests/`)

### `tests/setup.js`
**מה עושה:** מספק תשתית משותפת לכל קבצי הבדיקה: `connectTestDb` (מקים `MongoMemoryServer` — מונגו אמיתי שרץ בזיכרון, ללא תלות ברשת או ב-Atlas — ומתחבר אליו), `closeTestDb` (מנקה ומנתק), `clearTestDb` (מוחק את תוכן כל האוספים בין בדיקות כדי שכל בדיקה תתחיל ממצב נקי).
**תלוי ב:** `mongoose`, `mongodb-memory-server`.
**מי תלוי בו:** `tests/auth.test.js`, `tests/recipes.test.js`.

### `tests/auth.test.js`
בודק את `routes/authRoutes.js` בפועל (דרך `createApp()` + Supertest, לא mocks): הרשמה מוצלחת (כולל שהסיסמה מוצפנת ב-DB ולא חוזרת ללקוח), דחיית אימייל כפול, דחיית סיסמה קצרה, התחברות מוצלחת/כושלת, **בדיקות רגרסיה מפורשות ל-NoSQL injection** (C7 — שליחת `{$gt: ''}` בשדה אימייל או `{$ne: null}` בסיסמה חייבות להחזיר 401 ולא 500/200), ו-`GET /me` עם/בלי טוקן תקין.

### `tests/recipes.test.js`
בודק את `routes/recipeRoutes.js` בפועל: מבנה תשובת עימוד, שה-`GET /` לא חושף `instructions`/`ingredients` מלאים (M6), כיבוד `limit`, חיפוש לפי שם ומרכיב, **בריחה מתווי regex בחיפוש** (רגרסיה), `?mine=true` (דורש התחברות, ומחזיר רק את המתכונים של המשתמש המחובר), יצירה (דורשת טוקן, מתעלמת מ-`owner` שנשלח מהלקוח, דוחה מתכון בלי שם), הרשאות עריכה/מחיקה (בעלים מותר, משתמש אחר נחסם ב-403), 400/404 ל-ID לא תקין/לא קיים, ו-404 בפורמט JSON לנתיב לא קיים.

**מי תלוי בהם:** אף קובץ ייצור לא תלוי בקבצי הבדיקה — הם נצרכים רק על ידי `npm test` (`vitest run`), ומשמשים כרשת ביטחון לרגרסיות (חלק ניכר מהבדיקות כתובות במפורש כ"רגרסיה ל-X" כדי לוודא שממצאי הביקורת הקודמת לא יחזרו).

### `vitest.config.js`
קובץ תצורה ל-Vitest: `globals: true` (כדי ש-`describe`/`it`/`expect` יהיו זמינים גלובלית בלי import — נחוץ כי הפרויקט הוא CommonJS, ו-Vitest לא תומך ב-`require()` של ה-API שלו), `fileParallelism: false` (הבדיקות חולקות אותו `MongoMemoryServer`; הרצה מקבילה הייתה גורמת לקבצי בדיקה שונים לדרוס את ה-DB אחד של השני), ו-timeouts ארוכים (30–120 שניות) כי ההורדה הראשונה של בינארי MongoDB עבור `mongodb-memory-server` יכולה לקחת זמן.

---

## קבצי תצורה כלליים

### `package.json`
מגדיר את תלויות הפרויקט (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit`, `dotenv`, `@google/genai`) ואת סקריפטי ההרצה: `start` (הרצת פרודקשן), `dev` (nodemon — הפעלה מחדש אוטומטית בשינוי קובץ), `test`/`test:watch` (Vitest), `cleanup:uploads`. `"type": "commonjs"` קובע ש-`require`/`module.exports` הם תחביר המודולים בכל הפרויקט (לא ESM `import`/`export`).

### `.env` / `.env.example`
`.env.example` הוא תבנית מתועדת (לא נכנס ל-git במובן שהוא כן נכנס, אבל `.env` עצמו לא) לכל משתני הסביבה הנדרשים: `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (אופציונלי), `CLIENT_URL`. `config/env.js` אוכף בזמן ריצה שהחיוניים שבהם (`MONGO_URI`, `JWT_SECRET`) אכן קיימים.

### `.gitignore`
מוציא מ-git את `node_modules`, `.env` (סודות אמיתיים), ו-`uploads` (תמונות שנוצרות בזמן ריצה — תוכן זמני/נגזר, לא קוד מקור).

---

## מפת תלויות מלאה

```
server.js
 ├─→ config/env.js          (validateEnv)
 ├─→ config/db.js           (connectDB) ──→ mongoose, dns
 └─→ app.js                 (createApp)
      ├─→ routes/aiRecipes.js
      │     ├─→ config/gemini.js        ──→ @google/genai
      │     ├─→ middleware/auth.js       (protect)
      │     ├─→ middleware/rateLimit.js  (aiTextLimiter, aiImageLimiter)
      │     └─→ models/Recipe.js
      ├─→ routes/recipeRoutes.js
      │     ├─→ middleware/auth.js       (protect, optionalAuth)
      │     └─→ models/Recipe.js
      └─→ routes/authRoutes.js
            ├─→ models/User.js            ──→ bcryptjs
            ├─→ utils/generateToken.js    ──→ jsonwebtoken
            ├─→ middleware/auth.js        (protect)
            └─→ middleware/rateLimit.js   (authLimiter)

middleware/auth.js ──→ models/User.js, jsonwebtoken

scripts/*.js ──→ models/Recipe.js, models/User.js (ישירות, בלי דרך app.js)
utils/cleanupUploads.js ──→ models/Recipe.js

tests/*.test.js ──→ app.js (createApp), models/*, tests/setup.js
```
