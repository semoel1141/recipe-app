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
  const { user, syncing } = useAuth();
  const location = useLocation();

  // ממתינים לסנכרון ההרשאה מהשרת לפני שמחליטים. בלי זה, כניסה ישירה
  // לכתובת הזו נחסמת לפי ה-role הישן שב-localStorage - למשל מיד אחרי
  // שאדמין קידם את המשתמש, אבל הוא עוד לא התחבר מחדש.
  if (syncing) {
    return (
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-8 w-1/3 rounded bg-stone-200" />
        <div className="h-16 rounded bg-stone-100" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
