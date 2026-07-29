// בדיקה ידנית של זרימת ה-AI מקצה לקצה מול השרת שרץ. הרצה: node scripts/testAiFlow.js
// 127.0.0.1 ולא localhost - ה-fetch המובנה של Node פותר localhost ל-IPv6 (::1)
// והשרת מאזין על IPv4, מה שגורם ל-"fetch failed" מבלבל
const BASE = 'http://127.0.0.1:5000/api/recipes';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data.message}`);
  return data;
}

(async () => {
  console.log('1) יצירת מתכון...');
  const generated = await post('/generate', { prompt: 'פסטה פשוטה עם עגבניות' });
  console.log('   כותרת:', generated.title);
  console.log('   מרכיבים:', generated.ingredients.length, '| שלבים:', generated.instructions.length);

  console.log('\n2) בקשת שינוי: "חריף מאוד ובלי מוצרי חלב"...');
  const modified = await post('/modify', {
    recipe: generated,
    request: 'תעשה את זה חריף מאוד ובלי מוצרי חלב',
  });
  console.log('   כותרת:', modified.title);
  console.log('   תיאור:', modified.description);
  console.log('   מרכיבים:');
  modified.ingredients.forEach((i) => console.log('     -', i));

  console.log('\n3) בדיקת /save בלי טוקן (אמור להיכשל ב-401)...');
  try {
    await post('/save', { recipe: modified });
    console.log('   ✗ לא נחסם - בעיה!');
  } catch (err) {
    console.log('   ✓', err.message);
  }
})().catch((err) => {
  console.error('נכשל:', err.message);
  process.exit(1);
});
