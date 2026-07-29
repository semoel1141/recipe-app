import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// עוטף routes שדורשים התחברות - אם אין משתמש מחובר, מפנה לדף ההתחברות.
// שומר את העמוד שאליו ניסו להגיע ב-state, כדי שאחרי ההתחברות
// המשתמש יחזור לשם ולא ייזרק לדף הבית (H8).
export default function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
