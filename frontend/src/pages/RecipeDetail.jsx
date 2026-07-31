import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import RecipeImage from '../components/RecipeImage';
import RestaurantFinder from '../components/RestaurantFinder';

export default function RecipeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // מבטלים את הבקשה אם המשתמש עבר למתכון אחר לפני שהיא חזרה (H3),
    // אחרת תשובה ישנה עלולה לדרוס את המתכון שמוצג כרגע
    const controller = new AbortController();

    setRecipe(null);
    setError('');

    api
      .get(`/recipes/${id}`, { signal: controller.signal })
      .then(({ data }) => setRecipe(data))
      .catch((err) => {
        if (err.name === 'CanceledError') return;
        setError(err.response?.data?.message || 'שגיאה בטעינת המתכון');
      });

    return () => controller.abort();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('למחוק את המתכון הזה?')) return;
    setDeleting(true);
    try {
      await api.delete(`/recipes/${id}`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה במחיקת המתכון');
      setDeleting(false);
    }
  };

  // העמוד הזה לא עטוף ב-<Page> (בגלל ה-hero במלוא הרוחב),
  // ולכן מצבי הביניים מביאים את הריווח שלהם בעצמם
  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
        >
          חזרה לכל המתכונים
        </Link>
      </div>
    );
  }
  if (!recipe) {
    return (
      // שלד טעינה שמשקף את מבנה העמוד, כדי שלא תהיה קפיצת פריסה כשהתוכן מגיע
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-[45vh] w-full bg-stone-200 sm:h-[55vh]" />
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
          <div className="h-6 w-1/3 rounded bg-stone-200" />
          <div className="mt-4 h-4 w-2/3 rounded bg-stone-200" />
          <div className="mt-3 h-4 w-1/2 rounded bg-stone-200" />
        </div>
      </div>
    );
  }

  // owner יכול להיות null אם המשתמש שיצר את המתכון נמחק מהמסד (C2).
  // בלי optional chaining כאן ולמטה, כל העמוד קורס למסך לבן.
  const canEdit = user && (user._id === recipe.owner?._id || user.role === 'admin');

  return (
    <div>
      {/* hero במלוא רוחב המסך. אין כאן יותר טריק של margin שלילי + w-screen:
          העמוד הזה פשוט לא עטוף ב-<Page> המוגבל ברוחב (ראו App.jsx), ולכן
          w-full מספיק. כך גם נעלם הצורך ב-overflow-x:hidden גלובלי (M5). */}
      <div className="relative mb-12 h-[45vh] w-full sm:h-[55vh]">
        {/* eager - זו התמונה הראשית של העמוד, אין סיבה לדחות את טעינתה */}
        <RecipeImage
          src={recipe.imageUrl}
          alt={recipe.title}
          loading="eager"
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-center md:px-10">
          <h2 className="text-3xl font-bold text-white sm:text-5xl">{recipe.title}</h2>
          <p className="mt-3 font-light text-white/80">
            {[
              recipe.prepTime > 0 && `${recipe.prepTime} דקות`,
              recipe.servings > 0 && `${recipe.servings} מנות`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {/* התוכן שמתחת ל-hero חוזר לרוחב הסטנדרטי של האתר */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-12 md:px-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {recipe.aiGenerated && (
            <span className="mb-6 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              ✨ נוצר בעזרת AI
            </span>
          )}

          {recipe.description && (
            <p className="mb-8 text-lg font-light leading-relaxed text-stone-500">{recipe.description}</p>
          )}

          <h3 className="text-xl font-bold tracking-tight text-stone-900">הוראות הכנה</h3>
          {/* instructions נשמר כמחרוזת אחת עם \n בין השלבים - מפצלים לרשימה ממוספרת */}
          <ol className="mt-4 space-y-4">
            {String(recipe.instructions || '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-medium text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 font-light leading-relaxed text-stone-600">{step}</p>
                </li>
              ))}
          </ol>

          {/* מוסתר לגמרי כשהדגל RESTAURANT_FINDER כבוי בשרת */}
          <RestaurantFinder dish={recipe.title} />

          {canEdit && (
            <div className="mt-10 flex gap-3 border-t border-stone-200 pt-8">
              <Link
                to={`/recipes/${id}/edit`}
                className="rounded-md bg-stone-900 px-5 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-stone-700"
              >
                עריכה
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-200 px-5 py-2 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'מוחק...' : 'מחיקה'}
              </button>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-md bg-stone-100 p-6">
          <h3 className="text-lg font-bold tracking-tight text-stone-900">מרכיבים</h3>
          <ul className="mt-4 divide-y divide-stone-200">
            {recipe.ingredients.map((ingredient, i) => (
              <li key={i} className="py-3 font-light leading-relaxed text-stone-600 first:pt-0 last:pb-0">
                {ingredient}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-400">
            נוצר ע"י {recipe.owner?.name || 'משתמש שנמחק'}
          </p>
        </aside>
      </div>
    </div>
  );
}
