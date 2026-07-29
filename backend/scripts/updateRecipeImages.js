// מעדכן את תמונות המתכונים לתמונות מקצועיות מ-TheMealDB (API ציבורי חינמי, בלי מפתח).
// הרצה: node scripts/updateRecipeImages.js
require('dotenv').config({ quiet: true });
const dns = require('dns');
dns.setServers(['8.8.8.8']);

const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');

// מיפוי שם המתכון בעברית -> מונח חיפוש באנגלית ב-TheMealDB
const SEARCH_TERMS = {
  'חומוס ביתי': 'hummus',
  שקשוקה: 'shakshuka',
  'סלט ישראלי': 'greek salad',
  'מרק עדשים כתומות': 'split pea soup',
  'שניצל עוף פריך': 'sticky chicken',
  'פסטה ברוטב עגבניות וריחן': 'spaghetti bolognese',
  'עוגת שוקולד פשוטה': 'chocolate cake',
  פלאפל: 'falafel',
  'עוף בתנור עם תפוחי אדמה': 'roast chicken',
  'סלט טונה עם תירס': 'salmon avocado salad',
  'בורקס תפוחי אדמה': 'potato pie',
  'חביתה עם ירקות': 'omelette',
  פנקייקים: 'pancakes',
  'מרק ירקות חורפי': 'leblebi soup',
  סביח: 'eggplant',
  'קוסקוס עם ירקות': 'couscous',
  'עוגיות שוקולד צ׳יפס': 'jam jam cookies',
  לחם: 'bread',
};

async function findThumb(term) {
  const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`);
  const data = await res.json();
  return data.meals?.[0]?.strMealThumb || null;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const recipes = await Recipe.find().select('title imageUrl');
  let updated = 0;

  for (const recipe of recipes) {
    const term = SEARCH_TERMS[recipe.title];
    if (!term) {
      console.log(`- דילוג (אין מונח חיפוש מוגדר): ${recipe.title}`);
      continue;
    }

    const thumb = await findThumb(term);
    if (!thumb) {
      console.log(`- לא נמצאה תמונה עבור "${recipe.title}" (חיפוש: ${term}) - התמונה הקיימת נשארת`);
      continue;
    }

    await Recipe.updateOne({ _id: recipe._id }, { $set: { imageUrl: thumb } });
    console.log(`✓ ${recipe.title} -> ${thumb}`);
    updated++;
  }

  console.log(`\nעודכנו ${updated} מתוך ${recipes.length} מתכונים.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
