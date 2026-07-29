const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-only-not-production';

const createApp = require('../app');
const Recipe = require('../models/Recipe');
const { connectTestDb, closeTestDb, clearTestDb } = require('./setup');

const app = createApp();

const sampleRecipe = {
  title: 'שקשוקה',
  ingredients: ['4 ביצים', '6 עגבניות', 'פלפל חריף'],
  instructions: 'מטגנים עגבניות\nשוברים ביצים\nמבשלים 10 דקות',
  prepTime: 25,
  servings: 2,
};

// יוצר משתמש ומחזיר את הטוקן שלו
async function makeUser(email = 'owner@example.com') {
  const { body } = await request(app)
    .post('/api/auth/register')
    .send({ name: 'בעלים', email, password: 'secret123' });
  return { token: body.token, id: body._id };
}

beforeAll(connectTestDb, 60000);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe('GET /api/recipes', () => {
  it('מחזיר מבנה עם עימוד', async () => {
    const res = await request(app).get('/api/recipes');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recipes');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('pages');
    expect(Array.isArray(res.body.recipes)).toBe(true);
  });

  it('לא מחזיר את ההוראות והמרכיבים ברשימה (M6)', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/recipes').set('Authorization', `Bearer ${token}`).send(sampleRecipe);

    const res = await request(app).get('/api/recipes');

    expect(res.body.recipes[0].title).toBe(sampleRecipe.title);
    expect(res.body.recipes[0].instructions).toBeUndefined();
    expect(res.body.recipes[0].ingredients).toBeUndefined();
  });

  it('מכבד את פרמטר ה-limit', async () => {
    const { token } = await makeUser();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleRecipe, title: `מתכון ${i}` });
    }

    const res = await request(app).get('/api/recipes?limit=2');

    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.pages).toBe(3);
  });

  it('מחפש לפי שם ולפי מרכיב', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/recipes').set('Authorization', `Bearer ${token}`).send(sampleRecipe);

    const byTitle = await request(app).get('/api/recipes?search=שקשוקה');
    expect(byTitle.body.total).toBe(1);

    const byIngredient = await request(app).get('/api/recipes?search=עגבניות');
    expect(byIngredient.body.total).toBe(1);
  });

  // רגרסיה: תווי regex בקלט לא אמורים להתפרש כביטוי רגולרי
  it('בורח מתווי regex בחיפוש', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/recipes').set('Authorization', `Bearer ${token}`).send(sampleRecipe);

    const res = await request(app).get('/api/recipes?search=.*');

    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/recipes?mine=true', () => {
  it('דורש התחברות', async () => {
    const res = await request(app).get('/api/recipes?mine=true');
    expect(res.status).toBe(401);
  });

  it('מחזיר רק את המתכונים של המשתמש המחובר', async () => {
    const alice = await makeUser('alice@example.com');
    const bob = await makeUser('bob@example.com');

    await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ ...sampleRecipe, title: 'של אליס' });
    await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ ...sampleRecipe, title: 'של בוב' });

    const res = await request(app)
      .get('/api/recipes?mine=true')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.body.total).toBe(1);
    expect(res.body.recipes[0].title).toBe('של אליס');
  });
});

describe('POST /api/recipes', () => {
  it('דורש טוקן', async () => {
    const res = await request(app).post('/api/recipes').send(sampleRecipe);
    expect(res.status).toBe(401);
  });

  it('יוצר מתכון ומשייך אותו למשתמש מהטוקן', async () => {
    const { token, id } = await makeUser();
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleRecipe);

    expect(res.status).toBe(201);
    expect(res.body.owner).toBe(id);
  });

  // רגרסיה: אסור שהלקוח יוכל לקבוע owner אחר דרך ה-body
  it('מתעלם מ-owner שנשלח מהלקוח', async () => {
    const { token, id } = await makeUser();
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...sampleRecipe, owner: '000000000000000000000000' });

    expect(res.body.owner).toBe(id);
  });

  it('דוחה מתכון בלי שם', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...sampleRecipe, title: '' });

    expect(res.status).toBe(400);
  });
});

describe('PUT / DELETE /api/recipes/:id', () => {
  it('מונע ממשתמש אחר לערוך מתכון שאינו שלו', async () => {
    const alice = await makeUser('alice@example.com');
    const bob = await makeUser('bob@example.com');

    const created = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${alice.token}`)
      .send(sampleRecipe);

    const res = await request(app)
      .put(`/api/recipes/${created.body._id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'נחטף' });

    expect(res.status).toBe(403);
  });

  it('מונע ממשתמש אחר למחוק מתכון שאינו שלו', async () => {
    const alice = await makeUser('alice@example.com');
    const bob = await makeUser('bob@example.com');

    const created = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${alice.token}`)
      .send(sampleRecipe);

    const res = await request(app)
      .delete(`/api/recipes/${created.body._id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(403);
    expect(await Recipe.countDocuments()).toBe(1);
  });

  it('מאפשר לבעלים לערוך ולמחוק', async () => {
    const { token } = await makeUser();
    const created = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleRecipe);

    const updated = await request(app)
      .put(`/api/recipes/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'שקשוקה חריפה' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('שקשוקה חריפה');

    const deleted = await request(app)
      .delete(`/api/recipes/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(await Recipe.countDocuments()).toBe(0);
  });
});

describe('GET /api/recipes/:id', () => {
  it('מחזיר 400 למזהה לא תקין', async () => {
    const res = await request(app).get('/api/recipes/not-an-object-id');
    expect(res.status).toBe(400);
  });

  it('מחזיר 404 למזהה שלא קיים', async () => {
    const res = await request(app).get('/api/recipes/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('נתיב לא קיים', () => {
  it('מחזיר 404 בפורמט JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.message).toBeTruthy();
  });
});
