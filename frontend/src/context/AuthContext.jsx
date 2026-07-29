import { useState } from 'react';
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
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
