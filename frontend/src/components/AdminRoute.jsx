import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * עוטף routes שדורשים הרשאת אדמין.
 *
 * שני מצבים שונים בכוונה:
 * - לא מחובר בכלל -> מפנים להתחברות, עם שמירת היעד לחזרה (כמו PrivateRoute).
 * - מחובר אבל לא אדמין -> מפנים לדף הבית. לא מציגים "אין הרשאה" ולא
 *   מרמזים שהעמוד קיים, כדי לא לחשוף את קיומו של אזור הניהול.
 *
 * חשוב: זו שכבת UX בלבד. ההגנה האמיתית היא ב-middleware `admin` בשרת,
 * שמחזיר 403 לכל בקשה שאינה של אדמין - גם אם מישהו ינווט לכאן ידנית.
 */
export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
