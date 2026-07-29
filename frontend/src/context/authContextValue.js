import { createContext } from 'react';

// ה-context עצמו יושב בקובץ נפרד מ-AuthProvider.
// הסיבה: Fast Refresh של Vite עובד רק כשקובץ מייצא **רק** רכיבים - ערבוב של
// רכיב עם ייצוא של context/hook שבר את ה-hot reload (וגם הפיק אזהרת lint).
export const AuthContext = createContext(null);
