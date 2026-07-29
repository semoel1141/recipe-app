import { useContext } from 'react';
import { AuthContext } from '../context/authContextValue';

/**
 * hook נוח לשימוש: const { user, login, register, logout } = useAuth();
 * זורק שגיאה ברורה אם נעשה בו שימוש מחוץ ל-<AuthProvider>, במקום להחזיר
 * undefined ולהתפוצץ מאוחר יותר עם הודעה חסרת הקשר.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth חייב להיות בשימוש בתוך <AuthProvider>');
  }

  return context;
}
