const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-vitest-only-not-production';

const createApp = require('../app');
const User = require('../models/User');
const { connectTestDb, closeTestDb, clearTestDb } = require('./setup');

const app = createApp();

const validUser = { name: 'טסטר', email: 'tester@example.com', password: 'secret123' };

beforeAll(connectTestDb, 60000);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe('POST /api/auth/register', () => {
  it('יוצר משתמש ומחזיר טוקן', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.email).toBe(validUser.email);
    // הסיסמה לעולם לא אמורה לחזור ללקוח
    expect(res.body.password).toBeUndefined();
  });

  it('מצפין את הסיסמה במסד', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const user = await User.findOne({ email: validUser.email }).select('+password');
    expect(user.password).not.toBe(validUser.password);
    expect(user.password).toMatch(/^\$2[aby]\$/); // פורמט האש של bcrypt
  });

  it('דוחה אימייל שכבר קיים', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(400);
  });

  it('דוחה סיסמה קצרה מ-6 תווים', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: '123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('מחזיר טוקן לפרטים נכונים', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('דוחה סיסמה שגויה', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  // רגרסיה ל-C7: לפני התיקון, אובייקט במקום מחרוזת גרם ל-Mongoose
  // להחזיר את המשתמש הראשון במסד ולשגיאת 500 במקום 401
  it('חוסם ניסיון NoSQL injection בשדה האימייל', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: validUser.password });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('חוסם ניסיון NoSQL injection בשדה הסיסמה', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: { $ne: null } });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });
});

describe('GET /api/auth/me', () => {
  it('מחזיר את פרטי המשתמש עם טוקן תקין', async () => {
    const { body } = await request(app).post('/api/auth/register').send(validUser);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
  });

  it('דוחה בקשה בלי טוקן', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('דוחה טוקן מזויף', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});
