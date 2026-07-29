const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם הוא שדה חובה'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'אימייל הוא שדה חובה'],
      unique: true, // יוצר אינדקס ייחודי - מונע שני משתמשים עם אותו אימייל
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'כתובת אימייל לא תקינה'],
    },
    password: {
      type: String,
      required: [true, 'סיסמה היא שדה חובה'],
      minlength: [6, 'סיסמה חייבת להכיל לפחות 6 תווים'],
      select: false, // לא מוחזר בשאילתות רגילות (find/findOne) אלא אם מבקשים אותו במפורש
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// hook שרץ אוטומטית לפני שמירת מסמך - מצפין את הסיסמה כדי שלעולם לא נשמור טקסט גלוי
// הערה: החל מ-Mongoose 9 hooks הם async/await בלבד - אין יותר callback מסוג next()
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return; // אם הסיסמה לא השתנתה (למשל עדכון שם בלבד), אין צורך להצפין שוב
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// משווה סיסמה גלויה (מה שהמשתמש הקליד) מול ההאש השמור, לשימוש בלוגין
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
