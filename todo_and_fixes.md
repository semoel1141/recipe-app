# 🔍 Recipe App — דוח ביקורת קוד ורשימת משימות

> נוצר: 27/07/2026
> נבדק: כל קבצי `backend/` ו-`frontend/src/` + קבצי תצורה
> סטטוס בנייה: ✅ `npm run build` עובר (301KB JS / 96KB gzip) · ⚠️ `npm run lint` — warning אחד

---

## 📊 סיכום מנהלים

הפרויקט במצב **טוב מאוד** לבסיסו: הפרדת שכבות נכונה, אימות JWT תקין, בדיקות הרשאה בצד השרת (owner/admin), הצפנת סיסמאות, RTL מלא עם Tailwind logical properties, ו-fallback חכם לתמונות. הקוד קריא ומתועד היטב.

מה שחסר כדי להגיע ל"מושלם" מתחלק ל-3:
1. **באגים אמיתיים** שיפילו את האתר במצבים מסוימים (קריסות לבן, לולאות טעינה אינסופיות).
2. **חורי אבטחה** — בעיקר נתיבי ה-AI שפתוחים לחלוטין ללא אימות וללא הגבלת קצב.
3. **פיצ'רים חסרים** שהממשק כבר מבטיח למשתמש אבל לא קיימים (למשל "המתכונים שלי").

| חומרה | כמות | משמעות |
|-------|------|---------|
| 🔴 קריטי | 7 | יגרום לקריסה / חור אבטחה / שבירה בפרודקשן |
| 🟠 גבוה | 9 | באג נראה למשתמש או פיצ'ר חסר שהובטח |
| 🟡 בינוני | 11 | UX / ביצועים / נגישות |
| 🔵 שיפור | 8 | ליטוש, פיצ'רים עתידיים |

---

## 🔴 קריטי — לתקן ראשון

### C1. נתיבי ה-AI פתוחים לחלוטין — ניצול מכסת Gemini
**קובץ:** `backend/routes/aiRecipes.js:34, 56, 110`

`/generate`, `/modify` ו-`/generate-image` **אינם מוגנים ב-`protect`**. רק `/save` מוגן.
כל אדם באינטרנט שמכיר את הכתובת יכול לשרוף את מכסת ה-Gemini שלך, וב-`/generate-image` גם למלא את הדיסק בקבצים.

**תיקון:** להוסיף `protect` + rate limiting (`express-rate-limit`) על שלושת הנתיבים.
כיוון שהממשק מאפשר יצירה גם ללא התחברות — לכל הפחות **חובה** rate limit לפי IP; מומלץ לדרוש התחברות ליצירת תמונה (הפעולה היקרה).

---

### C2. קריסה לבנה בעמוד מתכון כשהיוצר נמחק
**קובץ:** `frontend/src/pages/RecipeDetail.jsx:38, 104`

```js
const canEdit = user && (user._id === recipe.owner._id || ...);  // ← owner יכול להיות null
<p>נוצר ע"י {recipe.owner.name}</p>                              // ← TypeError
```

`populate('owner')` מחזיר `null` אם מסמך המשתמש נמחק. התוצאה: `Cannot read properties of null` ומסך לבן מוחלט.

**תיקון:** optional chaining + ערך ברירת מחדל (`recipe.owner?.name || 'משתמש שנמחק'`).

---

### C3. לולאת טעינה אינסופית בטופס העריכה
**קובץ:** `frontend/src/pages/RecipeForm.jsx:23-34`

ל-`api.get()` **אין `.catch()`**. אם המתכון לא נמצא / השרת כבוי / ה-id שגוי — `setLoading(false)` לעולם לא נקרא, המשתמש תקוע לנצח על "טוען..." וב-console נזרקת unhandled promise rejection.

**תיקון:** `.catch()` שמציג שגיאה + מכבה טעינה.

---

### C4. כתובת תמונה אבסולוטית נשמרת ב-DB — נשברת בפרודקשן
**קובץ:** `backend/routes/aiRecipes.js:128-129`

```js
const baseUrl = `${req.protocol}://${req.get('host')}`;
return res.json({ imageUrl: `${baseUrl}/uploads/${fileName}` });
```

נשמר במסד `http://localhost:5000/uploads/abc.png`. ברגע שתעלה לשרת אמיתי — **כל התמונות שנוצרו ב-AI ישברו**. בנוסף, מאחורי proxy/HTTPS ‏`req.protocol` יחזיר `http` ויגרום ל-mixed content.

**תיקון:** לשמור נתיב יחסי (`/uploads/abc.png`) ולהרכיב את הכתובת המלאה בצד הלקוח.

---

### C5. קריסת האפליקציה כולה מ-localStorage פגום
**קובץ:** `frontend/src/context/AuthContext.jsx:14-17`

`JSON.parse(stored)` בתוך `useState` initializer — אם הערך ב-localStorage פגום (עריכה ידנית, כתיבה חלקית), נזרקת שגיאה **בזמן ה-mount הראשון** והאתר כולו לא נטען. אין ErrorBoundary שיתפוס.

**תיקון:** `try/catch` שמנקה את ה-localStorage ומחזיר `null`.

---

### C6. אין טיפול ב-401 — משתמש "מחובר" שכלום לא עובד לו
**קובץ:** `frontend/src/api/axios.js`

הטוקן תקף 30 יום. לאחר פקיעתו `user` עדיין יושב ב-localStorage, ה-Navbar מציג "שלום, X", `PrivateRoute` נותן גישה — אבל **כל פעולת כתיבה מחזירה 401** עם הודעה סתומה. אין response interceptor.

**תיקון:** interceptor שמזהה 401, מנקה אחסון ומפנה ל-`/login`.

---

### C7. NoSQL injection בהתחברות
**קובץ:** `backend/routes/authRoutes.js:36-40`

```js
const { email, password } = req.body;
const user = await User.findOne({ email }).select('+password');
```

שליחת `{"email": {"$gt": ""}}` תגרום ל-Mongoose להחזיר את **המשתמש הראשון במסד**. לא מדובר בעקיפת אימות (bcrypt עדיין ייכשל ויזרוק 500), אבל זהו משטח תקיפה לגיטימי לחלוטין שצריך לסגור — וגם מקור ל-500 במקום 401.

**תיקון:** לוודא `typeof email === 'string' && typeof password === 'string'` לפני השאילתה.

---

## 🟠 גבוה

### H1. "שמור למתכונים שלי" — אין "מתכונים שלי"
**קבצים:** `AiRecipeManager.jsx:272`, `Navbar.jsx`, `App.jsx`

הכפתור מבטיח דף אישי שפשוט לא קיים. אין route, אין קישור ב-Navbar, ואין endpoint לסינון לפי בעלים.

**תיקון:** `GET /api/recipes?mine=true` + עמוד `/my-recipes` + קישור ב-Navbar.

---

### H2. שגיאה ברשימת המתכונים "נתקעת" לנצח
**קובץ:** `frontend/src/pages/RecipeList.jsx:9, 26-28`

`setError` לעולם לא מתאפס. תקלת רשת חד-פעמית אחת → כל העמוד מוחלף בהודעת שגיאה, ושום הקלדה בחיפוש לא תחזיר אותו למצב תקין עד רענון ידני.

**תיקון:** `setError('')` בתחילת כל בקשה, והצגת השגיאה **מעל** הרשימה במקום במקומה.

---

### H3. Race condition בחיפוש — תוצאות ישנות דורסות חדשות
**קבצים:** `RecipeList.jsx:12-24`, `RecipeDetail.jsx:14-19`

אין `AbortController` ואין דגל cleanup. Debounce של 300ms מצמצם אבל לא מבטל: שתי בקשות שיצאו יכולות לחזור בסדר הפוך, והתוצאה של החיפוש הישן תדרוס את החדש. ב-`RecipeDetail` — מעבר מהיר בין מתכונים יציג את המתכון הלא נכון.

**תיקון:** `AbortController` + ביטול ב-cleanup של ה-effect.

---

### H4. הבהוב מסך מלא בכל הקלדה בחיפוש
**קובץ:** `frontend/src/pages/RecipeList.jsx:13`

`setLoading(true)` רץ **מיד** בכל תו — כל הרשת מוחלפת ב"טוען מתכונים..." ואז חוזרת. חוויה קופצנית מאוד.

**תיקון:** להשאיר את התוצאות הקיימות על המסך עם `opacity-50` במקום להחליף אותן.

---

### H5. `RecipeImage` נשאר "שבור" גם אחרי החלפת תמונה
**קובץ:** `frontend/src/components/RecipeImage.jsx:5`

`broken` הוא state שלא מתאפס כש-`src` משתנה. אחרי כישלון טעינה אחד, אותו מופע רכיב יציג placeholder לנצח — גם כשמגיעה כתובת תקינה חדשה (רלוונטי לכפתור "תמונה אחרת" ולסינון החיפוש).

**תיקון:** `key={src}` על הרכיב, או `useEffect` שמאפס.

---

### H6. אין דף 404
**קובץ:** `frontend/src/App.jsx:16-38`

כתובת לא מוכרת (`/blabla`) מרנדרת `<main>` ריק לגמרי — Navbar בלבד מעל חלל לבן. נראה כמו אתר שבור.

**תיקון:** `<Route path="*" element={<NotFound />} />`.

---

### H7. אין ErrorBoundary
**קובץ:** `frontend/src/main.jsx`

כל שגיאת רינדור (כמו C2/C5) = מסך לבן ללא שום מידע למשתמש.

**תיקון:** רכיב `ErrorBoundary` שעוטף את `<App />`.

---

### H8. אחרי התחברות המשתמש נזרק הביתה ומאבד את עבודתו
**קבצים:** `Login.jsx:22`, `Register.jsx:23`, `AiRecipeManager.jsx:280`

תרחיש: המשתמש מייצר מתכון ב-AI ← לוחץ "להתחבר" ← מתחבר ← **מנווט ל-`/` והמתכון שנוצר אבד**. `navigate('/')` קשיח, בלי `location.state.from`.

**תיקון:** לשמור מאיפה הגיע ולחזור לשם; ולשמר את המתכון שנוצר ב-`sessionStorage`.

---

### H9. השרת עולה בשקט גם בלי `JWT_SECRET`
**קובץ:** `backend/server.js`

אם המשתנה חסר, השרת יעלה כרגיל וכל התחברות תיכשל ב-500 מסתורי. אין בדיקת סביבה בהפעלה.

**תיקון:** בדיקת env חובה ב-boot עם `process.exit(1)` והודעה ברורה.

---

## 🟡 בינוני

### M1. Navbar לא רספונסיבי — גולש במסכים קטנים
**קובץ:** `frontend/src/components/Navbar.jsx:15-21`
`flex justify-between` עם `gap-6` ו-4 פריטים, ללא `flex-wrap` וללא תפריט המבורגר. ב-375px הפריטים נדחסים/גולשים. צריך תפריט מובייל או לפחות `flex-wrap` + הקטנת gap.

### M2. אין `loading="lazy"` על תמונות הרשת
**קובץ:** `RecipeList.jsx:73` — כל התמונות נטענות בבת אחת. עם 17 מתכונים זה ~2MB מיותרים בטעינה ראשונה.

### M3. שדה החיפוש ללא `<label>`
**קובץ:** `RecipeList.jsx:47` — רק `placeholder`. קורא מסך לא יידע מה השדה. צריך `aria-label` או label מוסתר.

### M4. חוסר עקביות במצבי טעינה
`RecipeList` מציג טקסט, `RecipeDetail` מציג "טוען...", `AiRecipeManager` מציג skeleton יפה. צריך skeleton אחיד בכל המקומות.

### M5. אין הגנה על `overflow-x: hidden` הגלובלי
**קובץ:** `index.css:11` — פתרון ה-hero במלוא הרוחב (`w-screen` + margin שלילי) מחייב `overflow-x: hidden` על `html`. זה עובד, אבל שביר ועלול להתנגש עם `sticky` של ה-Navbar בדפדפנים מסוימים. עדיף להוציא את ה-hero מחוץ ל-`<main>` המוגבל ברוחב.

### M6. `GET /api/recipes` מחזיר את כל השדות
**קובץ:** `recipeRoutes.js:20` — הרשימה צריכה רק `title, imageUrl, prepTime`, אבל מקבלת גם `instructions` ו-`ingredients` מלאים. `.select()` יקטין את התגובה משמעותית.

### M7. חיפוש regex ללא אינדקס
**קובץ:** `recipeRoutes.js:14-16` — סריקת collection מלאה בכל חיפוש. ב-17 מתכונים לא מורגש; ב-1000 כן. שקול text index.

### M8. אין pagination
`GET /api/recipes` מחזיר הכל תמיד. צריך `?page=&limit=`.

### M9. תמונות AI מצטברות בדיסק לנצח
**קובץ:** `aiRecipes.js:123-126` — תמונה נוצרת ונשמרת גם אם המשתמש לא שמר את המתכון. אין ניקוי. דורש cron/cleanup או שמירה רק בעת save.

### M10. `prepTime: 0` מוצג כ-"0 דקות"
**קבצים:** `RecipeList.jsx:81`, `RecipeDetail.jsx:49` — נראה שגוי. עדיף להסתיר או להציג "—".

### M11. אין תשתית בדיקות כלל
`backend/package.json:9` — `"test": "echo Error: no test specified && exit 1"`. אין ולו בדיקה אחת. מומלץ Vitest + Supertest לנתיבי auth ו-recipes.

---

## 🔵 שיפורים וליטוש

| # | נושא | פירוט |
|---|------|--------|
| L1 | **קבצי assets מיותמים** | `src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg` — **אף אחד מהם לא בשימוש בקוד** (אומת ב-grep). רק `favicon.svg` מקושר. למחוק. |
| L2 | **`frontend/vite.log`** | קובץ לוג 20KB שנשאר בתיקייה. למחוק (כבר ב-.gitignore). |
| L3 | **אין `.env.example`** | לא בפרונט ולא בבק. כל מי שיקלון את הפרויקט לא ידע אילו משתנים דרושים. |
| L4 | **תג "נוצר ב-AI"** | השדה `aiGenerated` קיים במודל אבל **לא מוצג בשום מקום** בממשק. |
| L5 | **חסר `helmet` + CORS פתוח** | `cors()` ללא `origin` מאפשר לכל דומיין. `helmet` לא מותקן כלל. |
| L6 | **אין 404 handler בשרת** | `server.js` — נתיב לא מוכר מחזיר HTML של Express במקום JSON. |
| L7 | **מטא-תגיות SEO** | `index.html` חסר `description`, Open Graph, ו-`theme-color`. |
| L8 | **lint warning** | `AuthContext.jsx:43` — `useAuth` מיוצא מאותו קובץ כמו הרכיב, שובר Fast Refresh. להעביר ל-`hooks/useAuth.js`. |

**רעיונות לפיצ'רים עתידיים:** מועדפים/שמירה, קטגוריות ותגיות, דירוג וביקורות, העלאת תמונה מהמחשב, מצב לילה, שיתוף מתכון, הדפסה, המרת כמויות לפי מספר סועדים.

---

## ✅ מה כבר טוב (לא לגעת)

- הפרדת שכבות נקייה: `models` / `routes` / `middleware` / `config`
- `owner` נלקח מהטוקן ולא מה-body — מונע התחזות ✔
- `delete req.body.owner` ב-PUT — מונע העברת בעלות ✔
- `password` עם `select: false` + hashing ב-`pre('save')` ✔
- הודעת התחברות כללית שלא חושפת אם האימייל קיים ✔
- בריחה מתווי regex בחיפוש ✔
- `asyncHandler` + error handler מרוכז ב-`aiRecipes.js` ✔
- רישום `aiRecipeRoutes` לפני `recipeRoutes` — מונע התנגשות עם `/:id` ✔
- RTL מלא עם `ps-`/`pe-`/`start-` (logical properties) ✔
- Fallback חכם: AI → TheMealDB → placeholder ✔
- `RecipeImage` עם `onError` — אין תמונות שבורות בממשק ✔

---

## 📋 סטטוס ביצוע

### ✅ בוצע (שלבים 1+2 — יציבות ואבטחה)

| # | תיאור | קבצים שהשתנו |
|---|-------|---------------|
| C1 | rate limiting על נתיבי AI ו-auth | `middleware/rateLimit.js` (חדש), `routes/aiRecipes.js`, `routes/authRoutes.js` |
| C2 | `owner?.name` — אין יותר קריסה לבנה | `pages/RecipeDetail.jsx` |
| C3 | `.catch()` + `AbortController` בטופס | `pages/RecipeForm.jsx` |
| C4 | נתיב תמונה יחסי + resolver בלקוח | `routes/aiRecipes.js`, `utils/imageUrl.js` (חדש), `RecipeImage.jsx`, `AiRecipeManager.jsx` |
| C5 | `try/catch` על localStorage | `context/AuthContext.jsx` |
| C6 | response interceptor ל-401 + הודעת "החיבור פג" | `api/axios.js`, `pages/Login.jsx` |
| C7 | חסימת NoSQL injection | `routes/authRoutes.js` |
| H2 | איפוס שגיאה + הצגה מעל הרשימה | `pages/RecipeList.jsx` |
| H3 | `AbortController` נגד race conditions | `RecipeList.jsx`, `RecipeDetail.jsx`, `RecipeForm.jsx` |
| H4 | עמעום במקום החלפה בזמן חיפוש | `pages/RecipeList.jsx` |
| H5 | איפוס מצב "שבור" ב-`useEffect` | `components/RecipeImage.jsx` |
| H7 | ErrorBoundary גלובלי | `components/ErrorBoundary.jsx` (חדש), `main.jsx` |
| H9 | בדיקת env בעליית השרת | `config/env.js` (חדש), `server.js` |
| L5 | helmet + CORS מוגבל לרשימה | `server.js` |
| L6 | 404 + error handler ב-JSON | `server.js` |
| L3 | קבצי `.env.example` | `backend/.env.example`, `frontend/.env.example` (חדשים) |
| L8 | הפרדת `useAuth` לקובץ נפרד — lint נקי | `hooks/useAuth.js`, `context/authContextValue.js` (חדשים) |
| M2 | `loading="lazy"` על תמונות | `components/RecipeImage.jsx` |
| M3 | `aria-label` לשדה החיפוש | `pages/RecipeList.jsx` |
| M4 | skeleton אחיד ברשימה | `pages/RecipeList.jsx` |
| M10 | הסתרת "0 דקות" | `RecipeList.jsx`, `RecipeDetail.jsx` |

**אימות:** `npm run lint` נקי (0 אזהרות) · `npm run build` עובר · השרת עולה, 404 מחזיר JSON, ניסיון injection מחזיר 401 במקום 500, כותרות helmet נוכחות.

### ✅ בוצע (שלבים 3–5 — פיצ'רים, UX וליטוש)

| # | תיאור | קבצים |
|---|-------|--------|
| H1 | דף "המתכונים שלי" + `?mine=true` בשרת | `pages/MyRecipes.jsx`, `middleware/auth.js` (`optionalAuth`), `routes/recipeRoutes.js` |
| H6 | דף 404 | `pages/NotFound.jsx`, `App.jsx` |
| H8 | חזרה לדף המקור אחרי התחברות + שמירת טיוטת AI ב-sessionStorage | `PrivateRoute.jsx`, `Login.jsx`, `Register.jsx`, `AiRecipeManager.jsx` |
| M1 | תפריט המבורגר למובייל + הדגשת הקישור הפעיל | `components/Navbar.jsx` |
| M5 | hero במלוא הרוחב בלי `w-screen`/margin שלילי — **`overflow-x:hidden` הגלובלי הוסר** | `App.jsx`, `RecipeDetail.jsx`, `index.css` |
| M6 | `.select()` ברשימה — בלי `instructions`/`ingredients` | `routes/recipeRoutes.js` |
| M7 | אינדקסים על `createdAt` ו-`owner` (ראו הערה למטה) | `models/Recipe.js` |
| M8 | עימוד + כפתור "טען עוד" | `hooks/useRecipeList.js`, `components/RecipeGrid.jsx` |
| M9 | ניקוי תמונות AI יתומות מהדיסק | `utils/cleanupUploads.js`, `scripts/cleanupUploads.js` |
| M11 | **28 בדיקות** (Vitest + Supertest + MongoMemoryServer) | `app.js`, `tests/` |
| L1 | מחיקת 4 קבצי assets יתומים | `hero.png`, `react.svg`, `vite.svg`, `icons.svg` |
| L2 | מחיקת `vite.log` | — |
| L4 | תג "✨ AI" ברשת ובעמוד המתכון | `RecipeGrid.jsx`, `RecipeDetail.jsx` |
| L7 | `description`, `theme-color`, Open Graph | `index.html` |
| — | `prefers-reduced-motion` (נגישות) | `index.css` |

**הערה על M7:** לא הוסף text index לחיפוש, בכוונה. החיפוש באתר הוא "תוך כדי הקלדה" עם התאמה חלקית (regex), ו-text index של מונגו מתאים רק למילים שלמות — הוא היה פוגע בחיפוש ולא עוזר. במקום זאת נוספו אינדקסים על `createdAt` ו-`owner`, שבהם באמת משתמשים למיון ולסינון. לנפחים גדולים הפתרון הנכון הוא Atlas Search עם autocomplete.

**הערה על M1:** המדידה בפועל הראתה שלא הייתה גלישה אופקית באף רוחב (1280/768/414/375/320) — הבעיה הייתה צפיפות, לא שבירה. הדירוג המקורי היה חמור מדי.

---

## 🎯 מצב סופי

**כל 35 הממצאים טופלו.**

**אימות:** `npm test` — 28/28 עוברות · `npm run lint` — נקי · `npm run build` — עובר · שני השרתים רצים מול MongoDB Atlas · Console בדפדפן נקי משגיאות.
