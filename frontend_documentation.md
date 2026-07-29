# תיעוד טכני — Frontend (Recipe App Client)

> סטאק: React 19 · React Router 7 · Tailwind CSS 4 (plugin ל-Vite, לא PostCSS) · Axios · Vite 8 · oxlint.

## תוכן עניינים

1. [ארכיטקטורה כללית](#ארכיטקטורה-כללית)
2. [נקודת כניסה: `main.jsx`, `App.jsx`](#נקודת-כניסה)
3. [שכבת API: `api/`](#שכבת-api-api)
4. [ניהול מצב גלובלי: `context/` ו-`hooks/`](#ניהול-מצב-גלובלי-context-ו-hooks)
5. [רכיבים משותפים: `components/`](#רכיבים-משותפים-components)
6. [עמודים: `pages/`](#עמודים-pages)
7. [כלי עזר: `utils/`](#כלי-עזר-utils)
8. [עיצוב וסגנון](#עיצוב-וסגנון)
9. [קבצי תצורה](#קבצי-תצורה)
10. [מפת תלויות מלאה](#מפת-תלויות-מלאה)

---

## ארכיטקטורה כללית

```
frontend/src/
├── main.jsx                    # נקודת כניסה - עוטף את כל האפליקציה
├── App.jsx                     # הגדרת כל ה-routes
├── index.css                   # ייבוא Tailwind + סגנון גלובלי מינימלי
├── api/
│   └── axios.js                  # מופע axios מוגדר + interceptors
├── context/
│   ├── authContextValue.js        # ה-Context עצמו (בקובץ נפרד בכוונה)
│   └── AuthContext.jsx             # ה-Provider עם לוגיקת login/register/logout
├── hooks/
│   ├── useAuth.js                  # hook לצריכת AuthContext
│   └── useRecipeList.js             # לוגיקת רשימת מתכונים (חיפוש/עימוד/ביטול)
├── components/
│   ├── ErrorBoundary.jsx            # רשת ביטחון מפני קריסות רינדור
│   ├── Navbar.jsx                    # סרגל ניווט עליון + תפריט מובייל
│   ├── PrivateRoute.jsx               # שומר routes מוגני-התחברות
│   ├── RecipeGrid.jsx                  # רשת כרטיסי מתכונים משותפת
│   ├── RecipeImage.jsx                  # תמונת מתכון עם נפילה לפלייסהולדר
│   ├── SearchInput.jsx                   # שדה חיפוש משותף
│   └── AiRecipeManager.jsx                # מסך יצירת/עריכת מתכון עם AI
├── pages/
│   ├── RecipeList.jsx                      # "/" - כל המתכונים
│   ├── MyRecipes.jsx                         # "/my-recipes"
│   ├── RecipeDetail.jsx                       # "/recipes/:id"
│   ├── RecipeForm.jsx                          # "/recipes/new" ו-"/recipes/:id/edit"
│   ├── Login.jsx                                # "/login"
│   ├── Register.jsx                              # "/register"
│   └── NotFound.jsx                                # "*"
└── utils/
    └── imageUrl.js                                  # פענוח כתובות תמונה
```

**עקרון ארכיטקטוני מרכזי:** לוגיקת עסקים (network calls, debounce, ניהול מצב טעינה/שגיאה) מרוכזת ב-**hooks** (`useRecipeList`) ולא בתוך רכיבי העמוד עצמם, כדי ש-`RecipeList.jsx` ו-`MyRecipes.jsx` — ששתיהן מציגות רשת מתכונים עם חיפוש ועימוד, בהבדל היחיד של פילטר `mine` — ישתפו קוד במקום לשכפל אותו.

**זרימת נתונים טיפוסית** (טעינת עמוד הבית): `main.jsx` מרנדר `App.jsx` בתוך `BrowserRouter`+`AuthProvider`+`ErrorBoundary` → ה-route `/` מרנדר `RecipeList.jsx` → זה קורא ל-hook `useRecipeList()` → ה-hook קורא ל-`api` (axios, מ-`api/axios.js`) שמצרף אוטומטית טוקן JWT מ-localStorage → תשובת ה-API (`backend/routes/recipeRoutes.js`) מוזרמת חזרה ל-hook → `RecipeList` מעביר את המצב ל-`RecipeGrid.jsx` לרינדור בפועל, כולל `RecipeImage.jsx` לכל כרטיס.

---

## נקודת כניסה

### `main.jsx`

**מה עושה בפועל:** ה-entry point של כל אפליקציית ה-React. יוצר את שורש ה-DOM (`createRoot`) ומרכיב סביב `<App />` שלוש שכבות עטיפה, מבחוץ פנימה: `<ErrorBoundary>` → `<BrowserRouter>` → `<AuthProvider>`.

**תלוי ב:** `react-dom/client`, `react-router-dom` (`BrowserRouter`), `./context/AuthContext` (`AuthProvider`), `./components/ErrorBoundary`, `./App.jsx`, `./index.css`.

**מי תלוי בו:** אין — זהו קובץ ה-bootstrap שנטען ישירות מ-`index.html` (`<script type="module" src="/src/main.jsx">`).

**תוצאה בפועל וסדר העטיפה החשוב:** `ErrorBoundary` הוא השכבה **החיצונית ביותר** במכוון — כך גם שגיאה שנזרקת בתוך `AuthProvider` עצמו (למשל קריאת `localStorage` פגומה, לפני שהיה תיקון ל-C5) תיתפס ותציג מסך "משהו השתבש" במקום דף לבן מוחלט. `<StrictMode>` מפעיל בדיקות פיתוח נוספות של React (כפל-הרצה מכוון של אפקטים כדי לחשוף באגי ניקוי) — משפיע רק על סביבת הפיתוח.

### `App.jsx`

**מה עושה בפועל:** מגדיר את כל מפת ה-routing של האפליקציה באמצעות `react-router-dom`, ועוטף כל עמוד ב-layout בסיסי (`Navbar` קבוע למעלה + `<main>`).

**תלוי ב:** `react-router-dom` (`Routes`, `Route`), `./components/Navbar`, `./components/PrivateRoute`, וכל שבעת קבצי `pages/` + `AiRecipeManager`.

**מי תלוי בו:** `main.jsx` בלבד (מיובא ומרונדר שם).

**תוצאה בפועל:**
- מגדיר helper פנימי, `Page`, שעוטף עמוד "רגיל" ב-`max-w-6xl` וריווח אחיד. **לא** כל ה-routes משתמשים בו: `RecipeDetail` מדולג בכוונה (`<Route path="/recipes/:id" element={<RecipeDetail />} />` בלי `<Page>`) כי לעמוד הזה יש hero-image שצריך לתפוס את **מלוא רוחב המסך**, ולכן הוא מנהל את הריווח שלו בעצמו.
- `/`, `/login`, `/register`, `/ai` פתוחים לכולם.
- `/my-recipes`, `/recipes/new`, `/recipes/:id/edit` עטופים ב-`<PrivateRoute>` — דורשים משתמש מחובר.
- `path="*"` (catch-all, **חייב** להיות ה-route האחרון ברשימה) מרנדר `NotFound` — זהו התיקון לממצא H6 (בלי זה, כתובת לא מוכרת הציגה `<main>` ריק לגמרי מתחת ל-Navbar).

---

## שכבת API (`api/`)

### `api/axios.js`

**מה עושה בפועל:** יוצר ומייצא מופע axios יחיד (`api`), מוגדר מראש עם כתובת בסיס (`VITE_API_URL`) ושני interceptors — אחד לבקשות יוצאות, אחד לתשובות נכנסות.

**תלוי ב:** `axios` (npm), משתנה הסביבה `import.meta.env.VITE_API_URL` (מוזרק על ידי Vite מקובץ `frontend/.env` בזמן build/dev).

**מי תלוי בו:** **כל** רכיב/עמוד/hook שמבצע קריאת רשת (`useRecipeList`, `AiRecipeManager`, `AuthContext`, `RecipeDetail`, `RecipeForm`) מייבא את המופע הזה — אין שום קריאת `fetch`/`axios` ישירה במקום אחר בקוד. גם `utils/imageUrl.js` תלוי בקובץ הזה (ב-`API_ORIGIN` המיוצא ממנו).

**תוצאה בפועל:**
- מחשב ומייצא `API_ORIGIN` — כתובת מקור השרת **בלי** הסיומת `/api` (למשל `http://localhost:5000` במקום `http://localhost:5000/api`) — נחוצה להרכבת כתובות לקבצים סטטיים (`/uploads/...`) שאינם תחת נתיב ה-API.
- **Request interceptor:** לפני כל בקשה יוצאת, שולף `token` מ-`localStorage` ומצרף `Authorization: Bearer <token>` אוטומטית אם קיים — כך שאף קריאת API בקוד לא צריכה "לזכור" לצרף את הטוקן בעצמה.
- **Response interceptor** (תיקון C6): מאזין לכל תשובה נכשלת. אם הקוד הוא 401 **וגם** היה בפועל טוקן שמור **וגם** אנחנו לא כבר בדף login/register — מנקה את ה-localStorage (`token`, `user`) ומפנה בכוח ל-`/login?expired=1`. שני התנאים הנוספים (מעבר לבדיקת 401 גרידא) קריטיים: בלי "היה טוקן", ניסיון פעולה בלי להתחבר בכלל היה גם הוא מפעיל הפניה מיותרת; בלי "לא בדף login" — סיסמה שגויה בדף ההתחברות עצמו (שגם היא 401) הייתה גורמת לרענון מיידי של הדף במקום להציג הודעת שגיאה ידידותית.
- אם `VITE_API_URL` לא מוגדר בכלל — מדפיס שגיאה ל-console בזמן טעינת המודול (עזרה לאבחון מוקדם, כי בלי זה כל הבקשות פשוט נשלחות לכתובת יחסית שגויה ומחזירות HTML).

---

## ניהול מצב גלובלי (`context/` ו-`hooks/`)

### `context/authContextValue.js`

**מה עושה:** קובץ מינימלי שמכיל אך ורק את `export const AuthContext = createContext(null)`.

**תלוי ב:** `react` (`createContext`) בלבד.

**מי תלוי בו:** `context/AuthContext.jsx` (ה-Provider כותב לתוכו) ו-`hooks/useAuth.js` (הצרכן קורא ממנו).

**תוצאה בפועל — למה זה קובץ נפרד:** Vite's Fast Refresh (hot reload בלי איבוד state) דורש שקובץ שמייצא רכיבי React יצא **רק** רכיבים. קובץ שמערבב רכיב (`AuthProvider`) עם ייצוא נוסף שאינו רכיב (ה-context הגולמי) שובר את המנגנון הזה בפועל (ומייצר גם אזהרת lint, `react-refresh/only-export-components`). הפרדת ה-context לקובץ ייעודי משלו פותרת את שתי הבעיות (ממצא L8).

### `context/AuthContext.jsx`

**מה עושה בפועל:** מגדיר את `AuthProvider`, רכיב שמחזיק את מצב האימות הגלובלי של האפליקציה (`user`) וחושף שלוש פעולות: `login`, `register`, `logout`.

**תלוי ב:** `react` (`useState`), `../api/axios` (`api`), `./authContextValue` (`AuthContext`).

**מי תלוי בו:** `main.jsx` (עוטף את `<App />` בו). בעקיפין — **כל** מקום שמשתמש ב-`useAuth()` (`Navbar`, `PrivateRoute`, `Login`, `Register`, `AiRecipeManager`, `MyRecipes`, `RecipeDetail`) תלוי בכך שה-Provider הזה קיים אי-שם למעלה בעץ הרכיבים.

**תוצאה בפועל:**
- `readStoredUser()` — פונקציית אתחול ל-`useState`, קוראת את `user` מ-`localStorage` בעטיפת `try/catch` (תיקון C5): בלי זה, ערך פגום ב-localStorage (עריכה ידנית של המשתמש, כתיבה שנקטעה) היה זורק שגיאה **בזמן ה-mount הראשון של כל האפליקציה**, לפני שה-`ErrorBoundary` בכלל רלוונטי לרינדור רגיל (הערה: כאן זה עדיין נתפס בזכות ה-ErrorBoundary שעוטף גם את ה-Provider, אבל עדיף למנוע את החריגה מלכתחילה). כמו כן מוודאת שהאובייקט שנקרא הוא באמת "צורת משתמש" (יש לו `_id`) ולא, למשל, המחרוזת `"undefined"` ששרדה מ-`JSON.stringify` שגוי.
- `persistUser({ token, ...userData })` — מפריד את הטוקן (הולך ל-`localStorage.token`, נקרא לאחר מכן ע"י `api/axios.js`) משאר פרטי המשתמש (`localStorage.user`, לשימוש מהיר ב-UI בלי לפענח את הטוקן).
- `login`/`register` — קוראים ל-endpoint המתאים, ואז קוראים ל-`setUser(persistUser(data))`: גם מעדכנים את ה-state בזיכרון (גורם ל-re-render מיידי של Navbar וכו') וגם כותבים ל-localStorage (שורד רענון דף).
- `logout` — מנקה localStorage ומאפס את ה-state בזיכרון.

### `hooks/useAuth.js`

**מה עושה:** hook דק, `useAuth()`, שעוטף `useContext(AuthContext)` ומחזיר את הערך.

**תלוי ב:** `react` (`useContext`), `../context/authContextValue`.

**מי תלוי בו:** `Navbar.jsx`, `PrivateRoute.jsx`, `Login.jsx`, `Register.jsx`, `AiRecipeManager.jsx`, `MyRecipes.jsx`, `RecipeDetail.jsx` — כל מקום שצריך לדעת "מי מחובר" או לבצע login/register/logout.

**תוצאה בפועל:** אם נקרא מחוץ ל-`<AuthProvider>` (טעות תכנותית), זורק שגיאה ברורה ("useAuth חייב להיות בשימוש בתוך <AuthProvider>") **מיד**, במקום להחזיר `null`/`undefined` ולגרום לקריסה חסרת הקשר עמוק יותר בקוד הצורך (למשל `Cannot read properties of null (reading 'user')`).

### `hooks/useRecipeList.js`

**מה עושה בפועל:** ה-hook המרכזי ביותר בלקוח מבחינת מורכבות לוגית. מספק לוגיקת רשימת מתכונים מלאה: חיפוש עם debounce, עימוד מצטבר ("טען עוד"), וביטול בקשות מיושנות. משותף בין `pages/RecipeList.jsx` (`useRecipeList()`) ל-`pages/MyRecipes.jsx` (`useRecipeList({ mine: true })`).

**תלוי ב:** `react` (`useCallback`, `useEffect`, `useRef`, `useState`), `../api/axios`.

**מי תלוי בו:** `pages/RecipeList.jsx`, `pages/MyRecipes.jsx`. שני העמודים מזינים את הפלט שלו ישירות ל-`components/RecipeGrid.jsx`.

**תוצאה בפועל, מנגנון-אחר-מנגנון:**
- **debounce מותנה:** חיפוש (`search` לא ריק) ממתין 300ms לפני שליחת בקשה; מעבר עמוד (`page`) נשלח מיידית (`delay = 0`) — אין סיבה לעכב טעינת "עוד תוצאות" בלחיצת כפתור.
- **ביטול בקשות (`AbortController`, תיקון H3):** בכל שינוי בתלויות ה-effect (`search`, `page`, `mine`) נוצר controller חדש, והבקשה הקודמת (אם עוד באוויר) מתבטלת בפונקציית ה-cleanup. בלי זה, הקלדה מהירה בחיפוש הייתה עלולה לגרום לתשובה **ישנה** לחזור **אחרי** תשובה חדשה יותר ולדרוס אותה במסך (race condition).
- **איפוס עמוד בחיפוש:** `useEffect` נפרד מאפס `page` ל-1 בכל שינוי של `search` או `mine` — אחרת חיפוש חדש בזמן שהמשתמש בעמוד 3 היה משאיר אותו "תקוע" בעמוד 3 של תוצאות החיפוש החדש (שאולי אין לו בכלל).
- **הבחנה בין `isInitialLoading` ל-`isRefreshing`:** טעינה ראשונית (אין עדיין תוצאות על המסך) לעומת רענון (יש תוצאות קיימות, בקשה חדשה בדרך) — מאפשר ל-`RecipeGrid` להציג שלד טעינה (skeleton) רק בפעם הראשונה, ועמעום עדין (`opacity-50`) על התוצאות הקיימות בחיפושים חוזרים, במקום להבהב את כל המסך על כל תו (תיקון H4).
- **עימוד מצטבר:** `loadMore()` מגדיל את `page`; בתשובה, אם `page === 1` הרשימה **מוחלפת**, אחרת התוצאות **מתווספות** לקיימות (`[...prev, ...data.recipes]`) — זהו מנגנון "טען עוד" ולא ניווט בין עמודים נפרדים.
- שגיאת רשת אמיתית (לא ביטול) נשמרת ב-`error` ומוצגת על ידי דף הצורך; `err.name === 'CanceledError'` מזוהה ומתעלם ממנו במפורש (זו לא שגיאה אמיתית, רק תוצאה של הביטול היזום).

---

## רכיבים משותפים (`components/`)

### `components/ErrorBoundary.jsx`

**מה עושה:** Class component (חובה — אין hook-equivalent ל-`componentDidCatch` נכון להיום) שתופס כל שגיאת רינדור בעץ הילדים שלו ומציג מסך חלופי ידידותי ("משהו השתבש") במקום מסך לבן.

**תלוי ב:** `react` (`Component`).

**מי תלוי בו:** `main.jsx` (עוטף את כל האפליקציה).

**תוצאה בפועל:** `getDerivedStateFromError` מעדכן state כדי לעבור למצב שגיאה ברינדור הבא; `componentDidCatch` מתעד ל-console לצורך דיבוג. בסביבת פיתוח (`import.meta.env.DEV`) מציג גם את הודעת השגיאה הגולמית לצורך אבחון; בפרודקשן מוסתרת מהמשתמש. כפתור "חזרה לדף הבית" מרענן טעינה מלאה (`window.location.assign`, לא ניווט SPA) — כדי לוודא שה-state השבור באמת מתאפס.

### `components/Navbar.jsx`

**מה עושה בפועל:** סרגל הניווט העליון, קבוע (`sticky top-0`) בראש כל עמוד. מציג קישורים שונים בהתאם למצב ההתחברות, ותומך בתפריט המבורגר במסכים קטנים.

**תלוי ב:** `react` (`useEffect`, `useState`), `react-router-dom` (`Link`, `NavLink`, `useNavigate`, `useLocation`), `../hooks/useAuth`.

**מי תלוי בו:** `App.jsx` (מרונדר פעם אחת, מעל כל ה-`<Routes>`).

**תוצאה בפועל:**
- רשימת הקישורים (`links`) מוגדרת **פעם אחת** ונצרכת גם בשורת הדסקטופ וגם בתפריט הנייד — מונע מצב שמוסיפים קישור בגרסה אחת ושוכחים בשנייה.
- `useEffect` שסוגר את התפריט הנייד בכל שינוי `location.pathname` — אחרת התפריט היה נשאר פתוח מעל עמוד חדש אחרי ניווט.
- למשתמש מחובר: קישורי "מתכון עם AI", "המתכונים שלי", כפתור "מתכון חדש", שם המשתמש, וכפתור התנתקות. ללא התחברות: רק "מתכון עם AI" (AI פתוח לכולם), "התחברות", "הרשמה".
- `handleLogout` קורא ל-`logout()` מה-context **וגם** סוגר את התפריט הנייד **וגם** מנווט הביתה — שלוש פעולות מפורשות ומכוונות בכל התנתקות.

### `components/PrivateRoute.jsx`

**מה עושה:** רכיב-עטיפה (wrapper) ל-routes שדורשים משתמש מחובר.

**תלוי ב:** `react-router-dom` (`Navigate`, `useLocation`), `../hooks/useAuth`.

**מי תלוי בו:** `App.jsx` — עוטף את `/my-recipes`, `/recipes/new`, `/recipes/:id/edit`.

**תוצאה בפועל (תיקון H8):** אם אין `user`, מפנה ל-`/login` **עם** `state={{ from: location }}` — כלומר שומר לאן המשתמש ניסה להגיע. `pages/Login.jsx` קורא את ה-state הזה כדי לחזור לשם בדיוק אחרי התחברות מוצלחת, במקום לזרוק את המשתמש הביתה ולאבד את ההקשר (למשל טופס שכבר התחיל למלא).

### `components/RecipeGrid.jsx`

**מה עושה בפועל:** מרנדר את רשת כרטיסי המתכונים (2 טורים במובייל, 4 בדסקטופ) בהתבסס לחלוטין על props — אין קריאת רשת/state פנימי משלו. משותף בין `RecipeList` ל-`MyRecipes`.

**תלוי ב:** `react-router-dom` (`Link`), `./RecipeImage`.

**מי תלוי בו:** `pages/RecipeList.jsx`, `pages/MyRecipes.jsx`.

**תוצאה בפועל:**
- `GridSkeleton` (רכיב פנימי, לא מיוצא) — מציג 8 ריבועים אפורים פועמים (`animate-pulse`) בזמן `isInitialLoading`, במקום מסך ריק.
- מצב "אין תוצאות" מציג `emptyMessage` שהעמוד הצורך מעביר (מנוסח שונה אם יש חיפוש פעיל לעומת רשימה ריקה אמיתית).
- כל כרטיס מתכון הוא `<Link>` שלם לעמוד הפרטים, עם גרדיאנט כהה מעל התמונה כדי שהכותרת הלבנה תמיד תהיה קריאה על כל תמונת רקע.
- תג "✨ AI" מוצג רק אם `recipe.aiGenerated === true` (השדה קיים מהתחלה במודל, אך היה "מת" — לא מוצג בשום מקום — עד תיקון L4).
- `isRefreshing` מפעיל `opacity-50` על כל הרשת (במקום להחליף אותה בשלד טעינה) — כך חיפוש שני ואילך מרגיש רציף ולא קופצני.
- כפתור "טען עוד מתכונים" מופיע רק אם `hasMore === true` (מגיע מה-hook), ומנוטרל בזמן `isRefreshing` כדי למנוע קליקים כפולים.

### `components/RecipeImage.jsx`

**מה עושה בפועל:** רכיב `<img>` "חכם" עם נפילה גרציונית לפלייסהולדר (אייקון SVG על רקע אפור) אם אין כתובת תמונה בכלל, או שהטעינה נכשלת בפועל (`onError`).

**תלוי ב:** `react` (`useEffect`, `useState`), `../utils/imageUrl` (`resolveImageUrl`).

**מי תלוי בו:** `components/RecipeGrid.jsx`, `pages/RecipeDetail.jsx`. (הערה: `components/AiRecipeManager.jsx` **לא** משתמש ברכיב הזה — משתמש ב-`<img>` גולמי + `resolveImageUrl` ישירות, כי יש לו לוגיקת שלד-טעינה ייעודית משלו בזמן שהתמונה עוד "בדרך" מה-AI.)

**תוצאה בפועל (תיקון H5):** ה-`useEffect` שמאפס `broken` ל-`false` בכל שינוי של `resolved` (הכתובת המפוענחת) הוא הליבה של התיקון: בלי זה, מופע רכיב יחיד שנכשל פעם אחת בטעינה היה נשאר "שבור" **לצמיתות**, גם אם מגיעה אחר כך כתובת חדשה ותקינה לגמרי (רלוונטי לכפתור "תמונה אחרת" ב-AI, ולסינון/חיפוש שמחליף את רשימת המתכונים המוצגת בלי ליצור מופעי React חדשים לכל כרטיס). `loading="lazy"` כברירת מחדל (ניתן לדריסה ל-`"eager"`, כפי שנעשה בתמונת ה-hero הראשית ב-`RecipeDetail`).

### `components/SearchInput.jsx`

**מה עושה:** שדה קלט חיפוש מעוצב עם אייקון זכוכית מגדלת, משותף בין `RecipeList` ל-`MyRecipes`.

**תלוי ב:** אין תלויות חיצוניות מעבר ל-React עצמו (רכיב "טיפש"/controlled לחלוטין).

**מי תלוי בו:** `pages/RecipeList.jsx`, `pages/MyRecipes.jsx`.

**תוצאה בפועל:** רכיב controlled טהור — כל הלוגיקה (debounce, state) יושבת ב-hook הצורך (`useRecipeList`), לא כאן. `aria-label={placeholder}` (תיקון M3) מבטיח שקורא מסך יידע למה משמש השדה, גם ללא `<label>` גלוי.

### `components/AiRecipeManager.jsx`

**מה עושה בפועל:** הרכיב המורכב ביותר בלקוח מבחינת ניהול state מקומי — כל מסך "מתכון עם AI": יצירת מתכון מפרומפט חופשי, בקשת שינויים בשפה טבעית, קבלת תמונה (אוטומטית ברקע), ושמירה סופית ל-DB.

**תלוי ב:** `react` (`useEffect`, `useState`), `react-router-dom` (`useNavigate`, `useLocation`), `../api/axios`, `../hooks/useAuth`, `../utils/imageUrl`.

**מי תלוי בו:** מרונדר ישירות ב-`App.jsx` תחת `/ai` (לא עטוף בקובץ `pages/` נפרד — זהו ה"עמוד" בפועל, ממוקם ב-`components/` כי מקורו כרכיב עצמאי שניתן להטמעה).

**תוצאה בפועל ומנגנוני מפתח:**
- **טיוטה שורדת ב-`sessionStorage`** (`DRAFT_KEY = 'ai-recipe-draft'`, תיקון H8): כל שינוי ב-`recipe` נשמר מיידית; בטעינת הרכיב, `readDraft()` משחזר אותו. זה פותר תרחיש קונקרטי: משתמש לא מחובר יוצר מתכון ב-AI, לוחץ "להתחבר" (מנווט ל-`/login` עם `state.from`), מתחבר, וחוזר לעמוד ה-AI — **בלי לאבד את המתכון שנוצר**, למרות שהרכיב עצמו עבר unmount/remount בדרך.
- **טעינת תמונה אסינכרונית לא-חוסמת:** `fetchImageFor` רצה **ברקע** אחרי `handleGenerate`/`handleModify` — המתכון (טקסט) כבר מוצג למשתמש מיד, והתמונה "נדבקת" אליו כשהיא מוכנה, בלי לגרום למשתמש לחכות לשתי קריאות API ברצף. כשלון בטעינת תמונה נבלע בשקט (רק `console.warn`) — מתכון בלי תמונה עדיין שימושי לגמרי, ואין הצדקה להציג שגיאה אדומה מפחידה בגלל זה.
- **שימור תמונה חכם ב-`handleModify`:** אם הכותרת לא השתנתה בעקבות בקשת השינוי, שומר את התמונה הקיימת; אם השתנתה מהותית — מבקש תמונה חדשה מתאימה, כי התמונה הישנה כנראה כבר לא מייצגת את המנה.
- **`toSteps()`** — פונקציה מקומית שמנרמלת בין שתי הצורות האפשריות של `instructions` (מערך מה-AI, לעומת מחרוזת עם `\n` אם המתכון נטען בעתיד מה-DB) לרשימת שלבים אחידה לתצוגה.
- כפתור "שמור למתכונים שלי" מוצג רק למשתמש מחובר; למשתמש לא מחובר מוצג קישור "להתחבר" שמעביר `state: { from: location }` (עקבי עם מנגנון ה-H8 בכל שאר האפליקציה).
- כל הפעולות האסינכרוניות (`generating`, `modifying`, `saving`, `savingImage`) מאוחדות למשתנה `busy` יחיד שמנטרל את כל הכפתורים בו-זמנית — מונע שליחה כפולה/מקבילה של פעולות סותרות.

---

## עמודים (`pages/`)

### `pages/RecipeList.jsx`
**מה עושה:** עמוד הבית (`/`) — כותרת, שדה חיפוש, ורשת כל המתכונים במערכת. **תלוי ב:** `../hooks/useRecipeList`, `../components/RecipeGrid`, `../components/SearchInput`. **מי תלוי בו:** `App.jsx` בלבד. **תוצאה בפועל:** כמעט ולא מכיל לוגיקה משלו — כל ה"עבודה" ב-hook; התפקיד היחיד של הקובץ הוא הרכבת ה-UI ו-copy (טקסטים) הספציפיים לעמוד הזה, כולל הצגת שגיאת רשת **מעל** הרשת ולא במקומה (תיקון H2 — כך תקלה חד-פעמית לא "מוחקת" את כל העמוד).

### `pages/MyRecipes.jsx`
**מה עושה:** עמוד "המתכונים שלי" (`/my-recipes`, מוגן ב-`PrivateRoute`) — זהה מבנית ל-`RecipeList` אך עם `useRecipeList({ mine: true })`. **תלוי ב:** `react-router-dom` (`Link`), `../hooks/useRecipeList`, `../hooks/useAuth`, `../components/RecipeGrid`, `../components/SearchInput`. **מי תלוי בו:** `App.jsx`. **תוצאה בפועל:** מוסיף מעל `RecipeGrid` מצב-ריק-אמיתי ייעודי (אין חיפוש פעיל **וגם** אין מתכונים בכלל) עם שני כפתורי קריאה-לפעולה ("כתיבת מתכון חדש" / "יצירת מתכון עם AI") — נותן למשתמש חדש עם 0 מתכונים כיוון ברור במקום מסך ריק "מת" (תיקון H1: הפיצ'ר "המתכונים שלי" הובטח ב-UI עוד לפני שהיה לו route/endpoint בכלל).

### `pages/RecipeDetail.jsx`
**מה עושה בפועל:** עמוד מתכון בודד (`/recipes/:id`) — hero-image במלוא רוחב המסך, תיאור, הוראות הכנה ממוספרות, מרכיבים בסיידבר, וכפתורי עריכה/מחיקה למי שרשאי.

**תלוי ב:** `react` (`useEffect`, `useState`), `react-router-dom` (`useParams`, `useNavigate`, `Link`), `../api/axios`, `../hooks/useAuth`, `../components/RecipeImage`.

**מי תלוי בו:** `App.jsx` (הרכיב היחיד ש**לא** עטוף ב-`<Page>` — ראו הסבר ב-`App.jsx`).

**תוצאה בפועל:**
- טעינה עם `AbortController` (תיקון H3): מעבר מהיר בין שני מתכונים (למשל דרך "אחורה" בדפדפן) לא יגרום לתשובה איטית של המתכון הקודם "לדרוס" את המתכון הנוכחי המוצג.
- `canEdit` מחושב עם **optional chaining על `recipe.owner`** (`user._id === recipe.owner?._id`) — תיקון C2: `populate('owner')` בשרת מחזיר `null` אם המשתמש שיצר את המתכון נמחק מה-DB; בלי ה-`?.` כאן (ובתצוגת "נוצר ע"י...") כל העמוד היה קורס עם `TypeError` ומציג מסך לבן.
- שלושה מצבי תצוגה נפרדים ומפורשים: שגיאה (`error`), טעינה (שלד/skeleton שמדמה את מבנה הדף הסופי כדי למנוע קפיצת פריסה), ותוכן מלא.
- `handleDelete` — אחרי אישור `window.confirm`, קורא ל-`DELETE /api/recipes/:id` ומנווט לעמוד הבית בהצלחה.

### `pages/RecipeForm.jsx`
**מה עושה בפועל:** טופס יחיד המשרת גם יצירה (`/recipes/new`) וגם עריכה (`/recipes/:id/edit`) — המצב נקבע לפי קיום `id` בפרמטרי ה-route (`isEditMode`).

**תלוי ב:** `react` (`useEffect`, `useState`), `react-router-dom` (`useParams`, `useNavigate`, `Link`), `../api/axios`.

**מי תלוי בו:** `App.jsx` (משמש בשני routes שונים).

**תוצאה בפועל:**
- במצב עריכה, טוען את המתכון הקיים עם `AbortController` **וחובה `.catch()`** (תיקון C3): בלי ה-`.catch()`, כל כשל בטעינה (מתכון לא קיים, שרת כבוי, ID שגוי) היה משאיר את `loading` על `true` **לנצח** — מסך "טוען..." קבוע, בלי שום דרך למשתמש להתאושש חוץ מרענון ידני.
- ממיר בין ייצוג הטופס (טקסט חופשי, שורה = מרכיב אחד) לייצוג ה-API (מערך מרכיבים): `ingredientsText.split('\n').map(trim).filter(Boolean)` בשליחה, וההפך (`.join('\n')`) בטעינה לעריכה.
- אם טעינת מתכון לעריכה נכשלת **ואין כותרת** (`error && !title`) — מציג הודעת שגיאה בלבד במקום טופס ריק, כדי למנוע מהמשתמש לשמור בטעות מתכון ריק על גבי המתכון האמיתי הקיים.
- שולח את אותו payload גם ליצירה (`POST /recipes`) וגם לעדכון (`PUT /recipes/:id`) — ה-API הוא זה שקובע מי מותר לו לבצע כל פעולה (הרשאות אינן נבדקות בצד הלקוח כלל, רק ב-UI מוצג/מוסתר קישור העריכה).

### `pages/Login.jsx`
**מה עושה:** טופס התחברות. **תלוי ב:** `react` (`useState`), `react-router-dom` (`useNavigate`, `useSearchParams`, `useLocation`, `Link`), `../hooks/useAuth`. **מי תלוי בו:** `App.jsx`. **תוצאה בפועל:** קורא `?expired=1` מה-query string (מוזרק על ידי `api/axios.js` כשה-interceptor מזהה טוקן שפג) ומציג הודעה מרגיעה ("החיבור פג תוקף") **לפני** שהמשתמש בכלל ניסה להתחבר — הבדל משמעותי מהודעת שגיאה אדומה שהייתה נראית כאילו המשתמש טעה. לאחר התחברות מוצלחת, מנווט ל-`location.state?.from?.pathname || '/'` — כלומר חזרה בדיוק למקום שממנו הגיע (תיקון H8), ולא תמיד לדף הבית. מעביר את אותו `state` הלאה לקישור ל-`/register`, כדי שגם מי שבוחר "אין לי חשבון" ישמור על יעד החזרה.

### `pages/Register.jsx`
**מה עושה:** טופס הרשמה — מבנית זהה כמעט לחלוטין ל-`Login.jsx` (אותו דפוס `returnTo`, אותה העברת `state` הלאה ל-`/login`). **תלוי ב:** `react` (`useState`), `react-router-dom` (`useNavigate`, `useLocation`, `Link`), `../hooks/useAuth`. **מי תלוי בו:** `App.jsx`. **תוצאה בפועל:** `minLength={6}` בצד הלקוח על שדה הסיסמה משקף (אך אינו מחליף) את הוולידציה האמיתית בסכמת ה-`User` בשרת — משוב מיידי למשתמש בלי לחכות לתשובת שרת, אך השרת הוא מקור האמת הסופי.

### `pages/NotFound.jsx`
**מה עושה:** עמוד 404 (route catch-all `*`). **תלוי ב:** `react-router-dom` (`Link`). **מי תלוי בו:** `App.jsx`. **תוצאה בפועל:** מציג שני קישורי המשך ברורים ("לכל המתכונים", "יצירת מתכון עם AI") במקום להשאיר את המשתמש במבוי סתום — תיקון H6 (לפני כן, כתובת שגויה הציגה `<main>` ריק לגמרי מתחת ל-Navbar בלבד).

---

## כלי עזר (`utils/`)

### `utils/imageUrl.js`

**מה עושה בפועל:** מייצא פונקציה יחידה, `resolveImageUrl(src)`, שממירה את הערך הגולמי שנשמר בשדה `imageUrl` של מתכון (כפי שמגיע מה-API) לכתובת שאפשר להזין ישירות ל-`<img src>`.

**תלוי ב:** `../api/axios` (`API_ORIGIN` המיוצא משם).

**מי תלוי בו:** `components/RecipeImage.jsx`, `components/AiRecipeManager.jsx`.

**תוצאה בפועל (תיקון C4, צד הלקוח):** מטפלת בשלוש צורות אפשריות של הערך השמור, בלי צורך במיגרציית נתונים היסטוריים:
1. נתיב יחסי מהשרת הנוכחי (`/uploads/abc.png`, הפורמט הנוכחי מ-`backend/routes/aiRecipes.js`) → מרכיבה `API_ORIGIN + value`.
2. כתובת חיצונית מלאה (`https://...` מ-TheMealDB, או `data:`/`blob:`) → מוחזרת כמו שהיא.
3. כתובת מלאה **ישנה** עם `localhost`/`127.0.0.1` קשיח (רשומות שנשמרו לפני שהשרת תוקן להחזיר נתיבים יחסיים) → מזוהה בדפוס regex ייעודי, ומתורגמת מחדש לכתובת ה-API ה**נוכחית** שהלקוח בפועל מדבר איתה. בלי הטיפול הזה, מתכוני AI ישנים היו מציגים תמונה שבורה בכל סביבה חדשה (למשל אחרי מעבר מ-localhost לפרודקשן).

---

## עיצוב וסגנון

### `index.css`
מייבא את Tailwind (`@import "tailwindcss"`, תחביר Tailwind 4 — לא PostCSS קונפיג נפרד) ומגדיר משתנה עיצוב יחיד (`--font-sans: 'Rubik', ...`, הפונט נטען ב-`index.html` דרך Google Fonts). כולל חסימת אנימציות גלובלית ל-`prefers-reduced-motion: reduce` (נגישות). **הערה מתועדת בקוד עצמו:** בעבר הכיל `overflow-x: hidden` גלובלי שהיה נחוץ בגלל טריק ישן ל-hero במלוא הרוחב (`w-screen` + margin שלילי); אחרי שה-hero נבנה מחדש (`App.jsx`/`RecipeDetail.jsx` מוציאים את העמוד מ-`<Page>` המוגבל ברוחב במקום), ה-`overflow-x:hidden` הוסר במכוון — הוא היה **מסתיר** גלישות אופקיות אמיתיות אחרות במקום לחשוף אותן (ממצא M5).

### `vite.config.js`
מגדיר את Vite עם שני plugins: `@vitejs/plugin-react` (JSX, Fast Refresh) ו-`@tailwindcss/vite` (אינטגרציית Tailwind 4 ישירה ב-Vite, בלי PostCSS/`tailwind.config.js` נפרד).

### `.oxlintrc.json`
תצורת linter (`oxlint`, חלופה מהירה יותר ל-ESLint) — אוכף `react/rules-of-hooks` כשגיאה (לא רק אזהרה) ו-`react/only-export-components` כאזהרה (הכלל שהוביל להפרדת `authContextValue.js` מ-`AuthContext.jsx`, ראו למעלה).

---

## קבצי תצורה

### `package.json`
תלויות ריצה: `react`, `react-dom`, `react-router-dom`, `axios`. תלויות פיתוח: `vite`, `@vitejs/plugin-react`, `tailwindcss`+`@tailwindcss/vite`, `oxlint`, `@types/react*` (הערות טיפוסים ל-IDE בלבד — הפרויקט עצמו הוא JavaScript, לא TypeScript). סקריפטים: `dev` (שרת פיתוח), `build` (build לפרודקשן ל-`dist/`), `lint`, `preview` (הרצת ה-build המקומי).

### `.env` / `.env.example`
משתנה יחיד: `VITE_API_URL` (למשל `http://localhost:5000/api`). קידומת `VITE_` **חובה** — Vite חושף ללקוח רק משתני סביבה שמתחילים כך (שאר `.env` לא מוזרק ל-bundle, מטעמי אבטחה — כדי שסודות בטעות לא ידלפו ל-JS הציבורי).

### `index.html`
תבנית ה-HTML היחידה של האפליקציה (SPA). `lang="he" dir="rtl"` (הוסף במכוון — חסר בברירת המחדל של תבנית Vite, וגרם לפריסת טקסט עברי שגויה). כולל metadata ל-SEO ו-Open Graph (תיאור, `theme-color`, תגיות `og:*`) — כדי שקישור לאתר שנשלח בוואטסאפ/פייסבוק יוצג עם כותרת ותיאור נכונים במקום כתובת URL גולמית.

---

## מפת תלויות מלאה

```
main.jsx
 ├─→ context/AuthContext.jsx (AuthProvider)
 │     ├─→ api/axios.js
 │     └─→ context/authContextValue.js
 ├─→ components/ErrorBoundary.jsx
 └─→ App.jsx
      ├─→ components/Navbar.jsx           ──→ hooks/useAuth.js
      ├─→ components/PrivateRoute.jsx      ──→ hooks/useAuth.js
      ├─→ components/AiRecipeManager.jsx    ──→ api/axios.js, hooks/useAuth.js, utils/imageUrl.js
      └─→ pages/*
            ├─→ RecipeList.jsx / MyRecipes.jsx
            │     ├─→ hooks/useRecipeList.js  ──→ api/axios.js
            │     ├─→ components/RecipeGrid.jsx ──→ components/RecipeImage.jsx ──→ utils/imageUrl.js
            │     └─→ components/SearchInput.jsx
            ├─→ RecipeDetail.jsx     ──→ api/axios.js, hooks/useAuth.js, components/RecipeImage.jsx
            ├─→ RecipeForm.jsx        ──→ api/axios.js
            ├─→ Login.jsx / Register.jsx ──→ hooks/useAuth.js
            └─→ NotFound.jsx

hooks/useAuth.js ──→ context/authContextValue.js
utils/imageUrl.js ──→ api/axios.js (API_ORIGIN)
```
