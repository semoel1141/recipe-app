import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  // כשל שקט מאוד לאיתור: כל הבקשות היו יוצאות לכתובת יחסית ומחזירות HTML
  console.error('VITE_API_URL לא מוגדר בקובץ frontend/.env - ראו .env.example');
}

// מקור השרת בלי הסיומת /api - משמש להרכבת כתובות של קבצים סטטיים (/uploads/...)
export const API_ORIGIN = (baseURL || '').replace(/\/api\/?$/, '');

const api = axios.create({ baseURL });

// interceptor שרץ לפני כל בקשה - מצמיד את טוקן ה-JWT (אם קיים) לכל בקשה יוצאת
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// interceptor על התשובות (C6): הטוקן תקף 30 יום, ואחרי שהוא פג המשתמש נשאר
// "מחובר" בממשק בזמן שכל פעולה נכשלת ב-401 מסתורי. כאן מזהים את המצב,
// מנקים את האחסון ומפנים להתחברות.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthError = error.response?.status === 401;
    const hadToken = Boolean(localStorage.getItem('token'));
    const onLoginPage = ['/login', '/register'].includes(window.location.pathname);

    // רק אם באמת היה טוקן - כדי לא לזרוק מהדף מישהו שסתם ניסה לפעול בלי להתחבר,
    // ולא בדף ההתחברות עצמו - כדי שסיסמה שגויה תציג הודעה במקום לרענן את הדף
    if (isAuthError && hadToken && !onLoginPage) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login?expired=1');
    }

    return Promise.reject(error);
  }
);

export default api;
