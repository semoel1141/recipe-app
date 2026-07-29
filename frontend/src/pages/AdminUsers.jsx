import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
        isAdmin ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
      }`}
    >
      {isAdmin ? '👑 אדמין' : 'משתמש'}
    </span>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // מזהה המשתמש שפעולה כלשהי רצה עליו כרגע - לנטרול הכפתורים שלו בלבד
  const [busyId, setBusyId] = useState(null);

  const loadUsers = useCallback(async (signal) => {
    try {
      const { data } = await api.get('/users', { signal });
      setUsers(data.users);
      setError('');
    } catch (err) {
      if (err.name === 'CanceledError') return;
      setError(err.response?.data?.message || 'שגיאה בטעינת המשתמשים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  const handleDelete = async (target) => {
    const recipeNote =
      target.recipeCount > 0
        ? `\n\n${target.recipeCount} המתכונים שלו יישארו באתר ויוצגו כ"נוצר ע״י משתמש שנמחק".`
        : '';

    if (!window.confirm(`למחוק את ${target.name} (${target.email})?${recipeNote}`)) return;

    setBusyId(target._id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.delete(`/users/${target._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== target._id));
      setNotice(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה במחיקת המשתמש');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (target) => {
    const nextRole = target.role === 'admin' ? 'user' : 'admin';

    setBusyId(target._id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/users/${target._id}/role`, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u._id === target._id ? { ...u, role: data.role } : u)));
      setNotice(`${data.name} עודכן להרשאת ${data.role === 'admin' ? 'אדמין' : 'משתמש'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בעדכון ההרשאה');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-8 w-1/3 rounded bg-stone-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded bg-stone-100" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">ניהול משתמשים</h2>
        <p className="mt-3 font-light text-stone-500">
          {users.length} משתמשים רשומים. אפשר להסיר משתמשים ולשנות הרשאות.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-8 rounded-md bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-8 rounded-md bg-emerald-50 px-4 py-3 text-emerald-800">
          {notice}
        </p>
      )}

      {/* overflow-x-auto כדי שהטבלה תגלול בתוך עצמה במובייל
          ולא תגרום לגלישה אופקית של כל העמוד */}
      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-start">
          <thead>
            <tr className="border-b border-stone-200 text-sm font-medium text-stone-400">
              <th className="pb-3 text-start font-medium">שם</th>
              <th className="pb-3 text-start font-medium">אימייל</th>
              <th className="pb-3 text-start font-medium">הרשאה</th>
              <th className="pb-3 text-start font-medium">מתכונים</th>
              <th className="pb-3 text-start font-medium">הצטרף</th>
              <th className="pb-3 text-end font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {users.map((u) => {
              const isSelf = u._id === currentUser?._id;
              const isBusy = busyId === u._id;

              return (
                <tr key={u._id} className={isBusy ? 'opacity-50' : ''}>
                  <td className="py-4 font-medium text-stone-800">
                    {u.name}
                    {isSelf && <span className="ms-2 text-xs font-light text-stone-400">(אתה)</span>}
                  </td>
                  <td className="py-4 font-light text-stone-600">{u.email}</td>
                  <td className="py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="py-4 font-light text-stone-600">{u.recipeCount}</td>
                  <td className="py-4 font-light text-stone-500">
                    {u.createdAt ? dateFormatter.format(new Date(u.createdAt)) : '—'}
                  </td>
                  <td className="py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleRoleChange(u)}
                        disabled={isBusy || isSelf}
                        title={isSelf ? 'אי אפשר לשנות את ההרשאה של עצמך' : ''}
                        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {u.role === 'admin' ? 'הסר אדמין' : 'הפוך לאדמין'}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isBusy || isSelf}
                        title={isSelf ? 'אי אפשר למחוק את המשתמש שאיתו אתה מחובר' : ''}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isBusy ? 'רגע...' : 'מחיקה'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
