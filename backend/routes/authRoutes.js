const express = require('express');
const router = express.Router();
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

// הגנה מפני NoSQL injection (C7): בלי הבדיקה הזו, שליחת {"email": {"$gt": ""}}
// גורמת ל-Mongoose להתייחס לאובייקט כאופרטור שאילתה ולהחזיר את המשתמש הראשון במסד.
// כאן אנחנו מוודאים שכל שדה שמגיע מהלקוח הוא באמת מחרוזת לפני שהוא נכנס לשאילתה.
function readCredentials(body, fields) {
  const result = {};
  for (const field of fields) {
    if (typeof body?.[field] !== 'string') return null;
    result[field] = body[field].trim();
  }
  return result;
}

// POST /api/auth/register - הרשמת משתמש חדש
router.post('/register', authLimiter, async (req, res) => {
  try {
    const credentials = readCredentials(req.body, ['name', 'email', 'password']);
    if (!credentials) {
      return res.status(400).json({ message: 'שם, אימייל וסיסמה הם שדות חובה' });
    }
    const { name, email, password } = credentials;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'כבר קיים משתמש עם אימייל זה' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login - התחברות
router.post('/login', authLimiter, async (req, res) => {
  try {
    const credentials = readCredentials(req.body, ['email', 'password']);
    if (!credentials) {
      // אותה הודעה כללית כמו בפרטים שגויים - לא מסגירים מידע למי שמנסה לתקוף
      return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });
    }
    const { email, password } = credentials;

    // password מוגדר עם select:false בסכמה, לכן חייבים לבקש אותו במפורש כאן
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      // הודעה כללית בכוונה - לא לחשוף אם הבעיה היא אימייל או סיסמה, מטעמי אבטחה
      return res.status(401).json({ message: 'אימייל או סיסמה שגויים' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/me - פרטי המשתמש המחובר (route מוגן, לבדיקת ה-middleware)
router.get('/me', protect, async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
});

module.exports = router;
