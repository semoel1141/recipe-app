import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const inputClass =
  'w-full rounded-md border border-stone-300 bg-stone-100 px-4 py-2.5 text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // מגיע מה-interceptor ב-axios.js כשהטוקן פג ונזרקנו לכאן (C6)
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';

  // העמוד שממנו נשלחנו לכאן (נשמר ב-PrivateRoute או בכפתור "להתחבר" של ה-AI).
  // אחרי התחברות מוצלחת חוזרים לשם במקום לדף הבית (H8).
  const returnTo = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהתחברות');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-md bg-white p-8 shadow-sm sm:p-12">
      <h2 className="text-2xl font-bold tracking-tight text-stone-900">התחברות</h2>

      {sessionExpired && !error && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-amber-800">
          החיבור פג תוקף. יש להתחבר מחדש.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          אימייל
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-fit rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'מתחבר...' : 'התחברות'}
        </button>
      </form>

      <p className="mt-6 font-light text-stone-500">
        אין לך חשבון?{' '}
        {/* מעבירים הלאה את יעד החזרה, כדי שגם מסלול ההרשמה יחזור לאותו מקום */}
        <Link
          to="/register"
          state={location.state}
          className="font-medium text-stone-900 hover:text-stone-600"
        >
          הרשמה
        </Link>
      </p>
    </div>
  );
}
