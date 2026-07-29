const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-only-not-production';

const createApp = require('../app');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { connectTestDb, closeTestDb, clearTestDb } = require('./setup');

const app = createApp();

/** נרשם דרך ה-API ומחזיר טוקן + מזהה. ההרשמה תמיד יוצרת role של 'user'. */
async function makeUser(email, name = 'משתמש') {
  const { body } = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return { token: body.token, id: body._id };
}

/** נרשם ואז מקדם ישירות במסד - כמו שהסקריפט make-admin עושה */
async function makeAdmin(email, name = 'אדמין') {
  const user = await makeUser(email, name);
  await User.findByIdAndUpdate(user.id, { role: 'admin' });
  return user;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(connectTestDb, 60000);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe('הרשאות גישה ל-/api/users', () => {
  it('דוחה בקשה בלי טוקן', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('דוחה משתמש רגיל ב-403', async () => {
    const user = await makeUser('user@example.com');
    const res = await request(app).get('/api/users').set(auth(user.token));

    expect(res.status).toBe(403);
  });

  it('מאפשר לאדמין', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const res = await request(app).get('/api/users').set(auth(adminUser.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe('GET /api/users', () => {
  it('מחזיר את כל המשתמשים עם ספירת מתכונים ובלי סיסמאות', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const bob = await makeUser('bob@example.com', 'בוב');

    await request(app)
      .post('/api/recipes')
      .set(auth(bob.token))
      .send({ title: 'של בוב', ingredients: ['ביצה'], instructions: 'לבשל' });

    const res = await request(app).get('/api/users').set(auth(adminUser.token));

    expect(res.body.total).toBe(2);
    const bobRow = res.body.users.find((u) => u.email === 'bob@example.com');
    expect(bobRow.recipeCount).toBe(1);
    expect(bobRow.password).toBeUndefined();

    // הממשק צריך לדעת מי המשתמש המחובר כדי להשבית לו את כפתור המחיקה
    const adminRow = res.body.users.find((u) => u.email === 'admin@example.com');
    expect(adminRow.isSelf).toBe(true);
    expect(bobRow.isSelf).toBe(false);
  });
});

describe('DELETE /api/users/:id', () => {
  it('אדמין מוחק משתמש רגיל', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const bob = await makeUser('bob@example.com');

    const res = await request(app).delete(`/api/users/${bob.id}`).set(auth(adminUser.token));

    expect(res.status).toBe(200);
    expect(await User.findById(bob.id)).toBeNull();
  });

  // החלטת מוצר: המתכונים נשארים באתר ומוצגים כ"נוצר ע"י משתמש שנמחק"
  it('משאיר את המתכונים של המשתמש שנמחק', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const bob = await makeUser('bob@example.com');

    await request(app)
      .post('/api/recipes')
      .set(auth(bob.token))
      .send({ title: 'נשאר אחרי המחיקה', ingredients: ['ביצה'], instructions: 'לבשל' });

    const res = await request(app).delete(`/api/users/${bob.id}`).set(auth(adminUser.token));

    expect(res.body.keptRecipes).toBe(1);
    expect(await Recipe.countDocuments()).toBe(1);

    // המתכון עדיין נגיש לציבור, עם owner ריק
    const list = await request(app).get('/api/recipes');
    expect(list.body.total).toBe(1);
    expect(list.body.recipes[0].owner).toBeNull();
  });

  it('חוסם אדמין שמנסה למחוק את עצמו', async () => {
    const adminUser = await makeAdmin('admin@example.com');

    const res = await request(app).delete(`/api/users/${adminUser.id}`).set(auth(adminUser.token));

    expect(res.status).toBe(400);
    expect(await User.findById(adminUser.id)).not.toBeNull();
  });

  it('חוסם מחיקה של האדמין האחרון', async () => {
    const first = await makeAdmin('admin1@example.com');
    const second = await makeAdmin('admin2@example.com');

    // מוחקים אחד - מותר, כי נשאר עוד אחד
    const ok = await request(app).delete(`/api/users/${second.id}`).set(auth(first.token));
    expect(ok.status).toBe(200);

    // עכשיו first הוא האחרון, וגם מחיקה שלו על ידי עצמו נחסמת
    const blocked = await request(app).delete(`/api/users/${first.id}`).set(auth(first.token));
    expect(blocked.status).toBe(400);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });

  it('מחזיר 404 למשתמש שלא קיים ו-400 למזהה לא תקין', async () => {
    const adminUser = await makeAdmin('admin@example.com');

    const notFound = await request(app)
      .delete('/api/users/000000000000000000000000')
      .set(auth(adminUser.token));
    expect(notFound.status).toBe(404);

    const badId = await request(app).delete('/api/users/not-an-id').set(auth(adminUser.token));
    expect(badId.status).toBe(400);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('מקדם משתמש רגיל לאדמין', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const bob = await makeUser('bob@example.com');

    const res = await request(app)
      .patch(`/api/users/${bob.id}/role`)
      .set(auth(adminUser.token))
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('דוחה ערך הרשאה לא חוקי', async () => {
    const adminUser = await makeAdmin('admin@example.com');
    const bob = await makeUser('bob@example.com');

    const res = await request(app)
      .patch(`/api/users/${bob.id}/role`)
      .set(auth(adminUser.token))
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
  });

  it('חוסם אדמין שמנסה להוריד הרשאה מעצמו', async () => {
    const adminUser = await makeAdmin('admin@example.com');

    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set(auth(adminUser.token))
      .send({ role: 'user' });

    expect(res.status).toBe(400);
  });
});
