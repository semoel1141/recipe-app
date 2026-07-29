import { useEffect, useState } from 'react';
import api from '../api/axios';
import { AuthContext } from './authContextValue';

// שומר טוקן + פרטי משתמש (בלי הטוקן) ב-localStorage כדי לשרוד רענון דף
function persistUser({ token, ...userData }) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  return userData;
}

// קריאה בטוחה מ-localStorage (C5).
// בלי try/catch, ערך פגום (עריכה ידנית, כתיבה שנקטעה) זורק שגיאה בזמן ה-mount
// הראשון של האפליקציה - כלומר מסך לבן מוחלט בלי שום דרך למשתמש להתאושש.
function readStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    // מוודאים שזה באמת אובייקט משתמש ולא מחרוזת/מספר ששרד parse
    if (!parsed || typeof parsed !== 'object' || !parsed._id) return null;

    return parsed;
  } catch {
    console.warn('פרטי המשתמש השמורים היו פגומים - מנקים ומתחילים מחדש');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // האם הסנכרון הראשוני מול השרת עדיין רץ.
  //
  // נחוץ כדי למנוע מרוץ: שומרי הנתיבים (AdminRoute/PrivateRoute) מחליטים
  // באופן סינכרוני ברינדור הראשון. בלי הדגל הזה, כניסה ישירה ל-/admin/users
  // הייתה נחסמת לפי ה-role הישן שב-localStorage ומפנה לדף הבית **לפני**
  // שתשובת /auth/me עם ההרשאה המעודכנת בכלל הספיקה לחזור.
  const [syncing, setSyncing] = useState(() => Boolean(localStorage.getItem('token')));

  // מסנכרן את פרטי המשתמש מהשרת בטעינת האפליקציה.
  //
  // הסיבה: ב-localStorage נשמר צילום מצב מרגע ההתחברות. אם ההרשאה השתנתה
  // מאז (למשל אדמין קידם את המשתמש, או הוריד לו הרשאה), הלקוח היה ממשיך
  // להאמין לערך הישן עד התחברות מחדש - ומציג או מסתיר את אזור הניהול לא נכון.
  //
  // אין כאן סיכון אבטחה בשני הכיוונים: השרת בודק את ההרשאה מחדש בכל בקשה,
  // אז ערך מנופח בלקוח לא נותן גישה אמיתית. זה תיקון של עקביות התצוגה.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;

    const controller = new AbortController();

    api
      .get('/auth/me', { signal: controller.signal })
      .then(({ data }) => {
        setUser((current) => {
          // אם המשתמש התנתק בינתיים, לא מחזירים אותו למצב מחובר
          if (!current) return current;
          localStorage.setItem('user', JSON.stringify(data));
          return data;
        });
      })
      .catch(() => {
        // 401 כבר מטופל ב-interceptor שב-api/axios.js (ניקוי והפניה ל-login).
        // כל שאר התקלות (רשת, שרת ישן) - ממשיכים עם הערך השמור.
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false);
      });

    return () => controller.abort();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(persistUser(data));
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    setUser(persistUser(data));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, syncing, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
