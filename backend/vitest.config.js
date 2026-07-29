import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // describe/it/expect זמינים גלובלית. נדרש כאן כי הפרויקט הוא CommonJS,
    // ו-Vitest לא מאפשר לייבא את ה-API שלו דרך require() - בלי זה כל
    // קובץ בדיקה היה חייב להיות ESM ולא יכול היה לעשות require למודולים של האפליקציה.
    globals: true,
    // הבדיקות משתמשות ב-MongoMemoryServer משותף; הרצה במקביל של קבצים
    // הייתה גורמת להם לדרוס זה את המסד של זה ב-clearTestDb
    fileParallelism: false,
    // ההורדה הראשונה של בינארי מונגו יכולה לקחת זמן
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
