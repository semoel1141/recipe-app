import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const inputClass =
  'w-full rounded-md border border-stone-300 bg-stone-100 px-4 py-2.5 text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהרשמה');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-md bg-white p-8 shadow-sm sm:p-12">
      <h2 className="text-2xl font-bold tracking-tight text-stone-900">הרשמה</h2>
      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          שם
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </label>
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
            minLength={6}
            required
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-fit rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'נרשם...' : 'הרשמה'}
        </button>
      </form>

      <p className="mt-6 font-light text-stone-500">
        כבר יש לך חשבון?{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-medium text-stone-900 hover:text-stone-600"
        >
          התחברות
        </Link>
      </p>
    </div>
  );
}
