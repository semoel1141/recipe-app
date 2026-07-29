const jwt = require('jsonwebtoken');

// יוצר JWT שמכיל את מזהה המשתמש - זה מה שיאפשר לזהות "מי מחובר" בבקשות עתידיות
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = generateToken;
