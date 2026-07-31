const {
  deriveSearchTerms,
  deriveCategory,
  getCuratedImage,
  matchesKeyword,
  filterWholeWord,
  pickStable,
  KEYWORD_TERMS,
} = require('../config/recipeImages');

describe('filterWholeWord - התאמות תת-מחרוזת שגויות', () => {
  it('פוסל "Pancakes" עבור המונח cake', () => {
    const meals = [{ strMeal: 'Banana Pancakes' }, { strMeal: 'Carrot Cake' }];

    expect(filterWholeWord(meals, 'cake')).toEqual([{ strMeal: 'Carrot Cake' }]);
  });

  it('פוסל "Breadfruit" עבור המונח bread', () => {
    const meals = [{ strMeal: 'Breadfruit in Butter Sauce' }, { strMeal: 'Rye bread' }];

    expect(filterWholeWord(meals, 'bread')).toEqual([{ strMeal: 'Rye bread' }]);
  });

  it('דורש שכל מילות המונח יופיעו', () => {
    const meals = [{ strMeal: 'Chocolate Gateau' }, { strMeal: 'Vegan Chocolate Cake' }];

    expect(filterWholeWord(meals, 'chocolate cake')).toEqual([{ strMeal: 'Vegan Chocolate Cake' }]);
  });

  it('מחזיר את הרשימה המלאה כשאין אף התאמת מילה שלמה', () => {
    // עדיף מועמד חלש מאשר לרדת מדרגה בשרשרת ולהישאר בלי תמונה
    const meals = [{ strMeal: 'Breadfruit in Butter Sauce' }];

    expect(filterWholeWord(meals, 'bread')).toEqual(meals);
  });

  it('לא קורס על רשימה ריקה', () => {
    expect(filterWholeWord([], 'cake')).toEqual([]);
    expect(filterWholeWord(null, 'cake')).toEqual([]);
  });
});

describe('matchesKeyword - סמיכות בעברית', () => {
  it('מתאים לצורה הרגילה', () => {
    expect(matchesKeyword('גלידה ביתית', 'גלידה')).toBe(true);
  });

  it('מתאים גם לצורת הסמיכות (ה סופית -> ת)', () => {
    expect(matchesKeyword('גלידת וניל ביתית', 'גלידה')).toBe(true);
    expect(matchesKeyword('עוגת תפוזים', 'עוגה')).toBe(true);
    expect(matchesKeyword('פשטידת ירק', 'פשטידה')).toBe(true);
  });

  it('מתאים גם לצורת הרבים (ה סופית -> ות)', () => {
    expect(matchesKeyword('פיתות ביתיות', 'פיתה')).toBe(true);
    expect(matchesKeyword('עוגות שוקולד', 'עוגה')).toBe(true);
    expect(matchesKeyword('חלות לשבת', 'חלה')).toBe(true);
  });

  it('לא ממציא התאמות למילים שלא מסתיימות ב-ה', () => {
    expect(matchesKeyword('סלט ירקות', 'שוקולד')).toBe(false);
  });
});

describe('deriveSearchTerms', () => {
  it('מחזיר מונח ספציפי ואחריו רחב', () => {
    expect(deriveSearchTerms('מוס שוקולד עשיר')).toEqual(['chocolate mousse', 'chocolate']);
  });

  it('מעדיף את הביטוי הספציפי על הכללי', () => {
    expect(deriveSearchTerms('עוגת גבינה אפויה')).toEqual(['cheesecake']);
  });

  it('תופס כותרת בצורת סמיכות', () => {
    expect(deriveSearchTerms('גלידת וניל ביתית')).toEqual(['ice cream']);
  });

  it('מחזיר רשימה ריקה כשאין מילת מפתח', () => {
    expect(deriveSearchTerms('משהו שלא קיים במילון')).toEqual([]);
    expect(deriveSearchTerms('')).toEqual([]);
  });

  it('לא משתמש ב-dessert כמונח חיפוש - הוא מחזיר 0 תוצאות ב-search.php', () => {
    // רגרסיה: 'dessert' שימש כמונח רחב לוופל/קרפ/גלידה/טירמיסו, והוא שם
    // קטגוריה ולא שם מנה. כתוצאה מכך כל המתכונים האלה נשארו בלי תמונה.
    const broadTerms = KEYWORD_TERMS.map(([, , broader]) => broader).filter(Boolean);
    expect(broadTerms).not.toContain('dessert');
  });
});

describe('deriveCategory', () => {
  it('ממפה קינוחים לקטגוריית Dessert', () => {
    expect(deriveCategory('מוס שוקולד בצנצנות')).toBe('Dessert');
    expect(deriveCategory('טירמיסו קלאסי')).toBe('Dessert');
  });

  it('ממפה לפי חלבון', () => {
    expect(deriveCategory('עוף בתנור')).toBe('Chicken');
    expect(deriveCategory('פילה סלמון')).toBe('Seafood');
  });

  it('עובד גם על צורת סמיכות', () => {
    expect(deriveCategory('עוגת תפוזים')).toBe('Dessert');
  });

  it('מחזיר null כשאין התאמה', () => {
    expect(deriveCategory('משהו לא מוכר')).toBeNull();
    expect(deriveCategory('')).toBeNull();
  });
});

describe('pickStable - הבאג של "אותה תמונה לכל מתכוני השוקולד"', () => {
  const meals = Array.from({ length: 16 }, (_, i) => ({ id: i }));

  it('מחזיר תמיד את אותו פריט לאותו שם מתכון', () => {
    const first = pickStable(meals, 'עוגת שוקולד');
    for (let i = 0; i < 20; i += 1) {
      expect(pickStable(meals, 'עוגת שוקולד')).toEqual(first);
    }
  });

  it('מחזיר פריטים שונים לשמות שונים', () => {
    // זה הלב של התיקון: קודם הקוד לקח תמיד את meals[0], ולכן כל מתכון
    // שנפל למונח 'chocolate' קיבל את אותה תמונה בדיוק
    const titles = ['עוגת שוקולד', 'מוס שוקולד', 'בראוני שוקולד', 'קרם שוקולד'];
    const picked = new Set(titles.map((t) => pickStable(meals, t).id));

    expect(picked.size).toBeGreaterThan(1);
  });

  it('לא בוחר תמיד את הראשון', () => {
    const titles = ['אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה'];
    const allFirst = titles.every((t) => pickStable(meals, t).id === 0);

    expect(allFirst).toBe(false);
  });

  it('מחזיר null לרשימה ריקה במקום לקרוס', () => {
    expect(pickStable([], 'משהו')).toBeNull();
    expect(pickStable(null, 'משהו')).toBeNull();
  });

  it('נשאר בתוך גבולות המערך', () => {
    const two = [{ id: 0 }, { id: 1 }];
    for (const t of ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז']) {
      expect(two).toContain(pickStable(two, t));
    }
  });
});

describe('getCuratedImage', () => {
  it('מחזיר כתובת קבועה למתכון מקורי', () => {
    expect(getCuratedImage('פלאפל')).toContain('http');
  });

  it('מחזיר null למתכון שאינו במפה', () => {
    expect(getCuratedImage('מתכון שהומצא עכשיו')).toBeNull();
  });
});
