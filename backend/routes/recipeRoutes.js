const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { protect, optionalAuth } = require('../middleware/auth');

const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 12;

// GET /api/recipes - רשימת מתכונים.
// פרמטרים: search (חיפוש חופשי), mine=true (רק שלי, דורש טוקן), page, limit.
// מחזיר { recipes, page, pages, total } - לא מערך חשוף - כדי שאפשר יהיה
// לצרף מטא-דאטה של עימוד בלי לשבור את הפורמט שוב בעתיד.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, mine } = req.query;
    const filter = {};

    if (typeof search === 'string' && search.trim()) {
      // בורחים מתווים מיוחדים של regex כדי שהחיפוש לא יתפרש כביטוי רגולרי
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ title: pattern }, { ingredients: pattern }];
    }

    // עמוד "המתכונים שלי" - הבעלים נלקח מהטוקן, לא מפרמטר בכתובת,
    // אחרת כל אחד היה יכול לבקש את המתכונים של כל משתמש אחר
    if (mine === 'true') {
      if (!req.user) {
        return res.status(401).json({ message: 'נדרשת התחברות כדי לראות את המתכונים שלך' });
      }
      filter.owner = req.user._id;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

    const [recipes, total] = await Promise.all([
      Recipe.find(filter)
        // הרשימה מציגה רק כותרת, תמונה וזמן - אין סיבה לשלוח את כל ההוראות
        // והמרכיבים של 20 מתכונים בכל טעינה (חסכון של ~80% מגודל התגובה)
        .select('title imageUrl prepTime servings aiGenerated createdAt owner')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('owner', 'name'),
      Recipe.countDocuments(filter),
    ]);

    res.json({
      recipes,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/recipes/:id - מתכון בודד (פתוח לכולם)
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate('owner', 'name');
    if (!recipe) {
      return res.status(404).json({ message: 'מתכון לא נמצא' });
    }
    res.json(recipe);
  } catch (error) {
    // CastError קורה כשה-id לא תואם לפורמט של Mongo ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה מתכון לא תקין' });
    }
    res.status(500).json({ message: error.message });
  }
});

// POST /api/recipes - יצירת מתכון חדש (רק למשתמש מחובר)
router.post('/', protect, async (req, res) => {
  try {
    // ה-owner נקבע מהטוקן המאומת (req.user), לא מגוף הבקשה - כדי שאף אחד לא יוכל
    // ליצור מתכון בשם משתמש אחר על ידי שליחת owner אחר ב-body
    const recipe = await Recipe.create({ ...req.body, owner: req.user._id });
    res.status(201).json(recipe);
  } catch (error) {
    // ValidationError קורה כששדה חובה חסר או לא עומד בכללי ה-schema
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/recipes/:id - עדכון מתכון קיים (רק הבעלים או אדמין)
router.put('/:id', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'מתכון לא נמצא' });
    }

    if (recipe.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'אין הרשאה לערוך מתכון זה' });
    }

    // מונע מהמשתמש לשנות את הבעלים, המזהה או חותמות הזמן דרך ה-body -
    // בלי זה, Object.assign למטה היה מאפשר ל-client לזייף createdAt (ולעקוף מיון
    // "החדש ביותר") או לנסות לשנות את ה-_id/גרסת המסמך
    delete req.body.owner;
    delete req.body._id;
    delete req.body.createdAt;
    delete req.body.updatedAt;
    delete req.body.__v;

    Object.assign(recipe, req.body);
    await recipe.save();

    res.json(recipe);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה מתכון לא תקין' });
    }
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/recipes/:id - מחיקת מתכון (רק הבעלים או אדמין)
router.delete('/:id', protect, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'מתכון לא נמצא' });
    }

    if (recipe.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'אין הרשאה למחוק מתכון זה' });
    }

    await recipe.deleteOne();
    res.json({ message: 'המתכון נמחק בהצלחה' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה מתכון לא תקין' });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
