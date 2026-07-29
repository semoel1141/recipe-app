const jwt = require('jsonwebtoken');
const User = require('../models/User');

// middleware שבודק שיש טוקן תקין ב-header ומצמיד את המשתמש המחובר ל-req.user
// כל route שמשתמש בו חייב Authorization: Bearer <token>
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'לא מחובר - נדרש טוקן' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ message: 'המשתמש ששייך לטוקן זה כבר לא קיים' });
    }

    next();
  } catch (error) {
    // jwt.verify זורק שגיאה אם הטוקן פג תוקף, מזויף, או לא תואם ל-JWT_SECRET
    return res.status(401).json({ message: 'טוקן לא תקין או שפג תוקפו' });
  }
};

// כמו protect, אבל לא חוסם: אם יש טוקן תקין - מצמיד את המשתמש ל-req.user,
// ואם אין (או שהוא פגום) - פשוט ממשיך עם req.user = undefined.
// משמש ב-routes שפתוחים לכולם אבל מתנהגים אחרת למשתמש מחובר,
// למשל GET /api/recipes?mine=true.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch {
    // טוקן לא תקין נחשב כאן פשוט כ"לא מחובר" - ה-route יחליט אם זה מספיק
  }

  next();
};

// middleware שרץ אחרי protect - דורש שהמשתמש המחובר יהיה בעל role של admin
const admin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'נדרשות הרשאות אדמין' });
  }
  next();
};

module.exports = { protect, optionalAuth, admin };
