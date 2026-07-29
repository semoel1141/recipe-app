import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const inputClass =
  'w-full rounded-md border border-stone-300 bg-stone-100 px-4 py-2.5 text-stone-700 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none';

export default function RecipeForm() {
  const { id } = useParams(); // אם קיים - אנחנו במצב עריכה, אחרת יצירה
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [ingredientsText, setIngredientsText] = useState(''); // שורה אחת = מרכיב אחד
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState(0);
  const [servings, setServings] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;

    const controller = new AbortController();

    api
      .get(`/recipes/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        setTitle(data.title);
        setIngredientsText((data.ingredients || []).join('\n'));
        setInstructions(data.instructions || '');
        setPrepTime(data.prepTime ?? 0);
        setServings(data.servings ?? 1);
        setImageUrl(data.imageUrl || '');
      })
      // בלי ה-catch הזה (C3): כל תקלה - מתכון שלא קיים, שרת כבוי, id שגוי -
      // משאירה את loading על true לנצח, והמשתמש תקוע על "טוען..." בלי שום הסבר
      .catch((err) => {
        if (err.name === 'CanceledError') return;
        setError(err.response?.data?.message || 'שגיאה בטעינת המתכון לעריכה');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      title,
      ingredients: ingredientsText.split('\n').map((line) => line.trim()).filter(Boolean),
      instructions,
      prepTime: Number(prepTime),
      servings: Number(servings),
      imageUrl: imageUrl.trim(),
    };

    try {
      if (isEditMode) {
        await api.put(`/recipes/${id}`, payload);
        navigate(`/recipes/${id}`);
      } else {
        const { data } = await api.post('/recipes', payload);
        navigate(`/recipes/${data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשמירת המתכון');
      setSubmitting(false);
    }
  };

  if (loading) return <p className="font-light text-stone-500">טוען...</p>;

  // אם הטעינה לעריכה נכשלה, הטופס ריק - הצגתו תגרום למשתמש לשמור בטעות
  // מתכון ריק על גבי הקיים. במקרה כזה מציגים שגיאה בלבד.
  if (isEditMode && error && !title) {
    return (
      <div className="mx-auto max-w-md text-center">
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

  return (
    <div className="mx-auto max-w-xl rounded-md bg-white p-8 shadow-sm sm:p-12">
      <h2 className="text-2xl font-bold tracking-tight text-stone-900">
        {isEditMode ? 'עריכת מתכון' : 'מתכון חדש'}
      </h2>
      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          שם המתכון
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          מרכיבים (מרכיב אחד בכל שורה)
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={5}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          הוראות הכנה
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
          קישור לתמונה (אופציונלי)
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-6">
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            זמן הכנה (דקות)
            <input
              type="number"
              min={0}
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            מספר מנות
            <input
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-fit rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'שומר...' : isEditMode ? 'שמירה' : 'יצירה'}
        </button>
      </form>
    </div>
  );
}
