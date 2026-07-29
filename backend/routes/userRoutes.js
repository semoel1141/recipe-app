const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { protect, admin } = require('../middleware/auth');

/**
 * ניהול משתמשים - פתוח לאדמינים בלבד.
 *
 * כל הנתיבים כאן עוברים דרך protect (אימות טוקן) ואז admin (בדיקת role).
 * עד עכשיו ה-middleware `admin` היה מוגדר ב-middleware/auth.js אבל לא היה
 * בשימוש באף route - כלומר הרשאת האדמין הייתה קיימת במודל אבל לא עשתה כלום
 * מעבר לעקיפת בדיקת הבעלות בעריכת/מחיקת מתכון.
 */

// כל הנתיבים בקובץ דורשים משתמש מחובר עם הרשאת אדמין
router.use(protect, admin);

// GET /api/users - רשימת כל המשתמשים, כולל מספר המתכונים של כל אחד
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('name email role createdAt').sort({ createdAt: -1 }).lean();

    // ספירת מתכונים לכל המשתמשים בשאילתה אחת (aggregate) במקום N שאילתות נפרדות
    const counts = await Recipe.aggregate([{ $group: { _id: '$owner', count: { $sum: 1 } } }]);
    const countByOwner = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
      users: users.map((u) => ({
        ...u,
        recipeCount: countByOwner.get(String(u._id)) || 0,
        // מסמן את המשתמש המחובר, כדי שהממשק יוכל להשבית את כפתור המחיקה שלו
        isSelf: String(u._id) === String(req.user._id),
      })),
      total: users.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id - מחיקת משתמש (אדמין בלבד)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    // הגנה 1: אדמין לא יכול למחוק את עצמו. בלי זה קל מאוד לנעול את עצמך
    // בטעות מחוץ למערכת בלחיצה אחת, בלי דרך לחזור.
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'אי אפשר למחוק את המשתמש שאיתו אתה מחובר' });
    }

    // הגנה 2: חייב להישאר לפחות אדמין אחד. מחיקת האחרון הופכת את ניהול
    // המערכת לבלתי אפשרי דרך הממשק.
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'אי אפשר למחוק את האדמין האחרון במערכת' });
      }
    }

    // המתכונים שלו **נשארים** באתר במכוון (החלטת מוצר).
    // populate('owner') יחזיר null עבורם, והממשק מציג "נוצר ע"י משתמש שנמחק"
    // בזכות ה-optional chaining ב-RecipeDetail (תיקון C2).
    const recipeCount = await Recipe.countDocuments({ owner: user._id });

    await user.deleteOne();

    res.json({
      message: `המשתמש ${user.name} נמחק`,
      keptRecipes: recipeCount,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה משתמש לא תקין' });
    }
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/users/:id/role - שינוי הרשאה בין user לאדמין
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;

    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ message: "ההרשאה חייבת להיות 'user' או 'admin'" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    // אותה הגנה כמו במחיקה: אסור להוריד את עצמך מאדמין (נעילה עצמית),
    // ואסור להוריד את האדמין האחרון.
    if (role === 'user' && user.role === 'admin') {
      if (String(user._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'אי אפשר להסיר הרשאת אדמין מעצמך' });
      }
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'אי אפשר להסיר את האדמין האחרון במערכת' });
      }
    }

    user.role = role;
    await user.save();

    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה משתמש לא תקין' });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
