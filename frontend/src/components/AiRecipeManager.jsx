import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { resolveImageUrl } from '../utils/imageUrl';

// המתכון שנוצר נשמר ב-sessionStorage כדי לשרוד את המעבר להתחברות וחזרה (H8).
// בלי זה, משתמש לא מחובר שלוחץ "להתחבר" מאבד מתכון שלקח 20 שניות לייצר.
const DRAFT_KEY = 'ai-recipe-draft';

function readDraft() {
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    sessionStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

const inputClass =
  'w-full rounded-md border border-stone-300 bg-stone-100 px-4 py-3 text-stone-700 transition-colors placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none disabled:opacity-60';

const buttonClass =
  'shrink-0 rounded-md bg-stone-900 px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60';

const EXAMPLE_PROMPTS = [
  'ארוחת ערב מהירה לשני אנשים',
  'קינוח שוקולד בלי אפייה',
  'מנה טבעונית עשירה בחלבון',
];

// ממיר instructions לרשימת שלבים - ה-AI מחזיר מערך, אבל מתכון שנטען מה-DB
// מגיע כמחרוזת אחת עם \n בין השלבים
function toSteps(instructions) {
  if (Array.isArray(instructions)) return instructions;
  return String(instructions || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

export default function AiRecipeManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [prompt, setPrompt] = useState('');
  const [modifyRequest, setModifyRequest] = useState('');
  const [recipe, setRecipe] = useState(readDraft);

  const [generating, setGenerating] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = generating || modifying || saving || savingImage;

  // מסנכרן את הטיוטה ל-sessionStorage בכל שינוי במתכון
  useEffect(() => {
    if (recipe) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(recipe));
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, [recipe]);

  // מביא תמונה למתכון ומצרף אותה לאובייקט. נכשל בשקט (רק לוג) - מתכון בלי תמונה
  // עדיין שימושי לגמרי, ואין סיבה להציג למשתמש שגיאה אדומה בגלל זה.
  const fetchImageFor = async (targetRecipe) => {
    setSavingImage(true);
    try {
      const { data } = await api.post('/recipes/generate-image', {
        title: targetRecipe.title,
        description: targetRecipe.description,
      });
      setRecipe((current) =>
        current && current.title === targetRecipe.title
          ? { ...current, imageUrl: data.imageUrl }
          : current
      );
    } catch (err) {
      console.warn('לא הצלחנו להביא תמונה למתכון:', err.response?.data?.message || err.message);
    } finally {
      setSavingImage(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setError('');
    setGenerating(true);
    try {
      const { data } = await api.post('/recipes/generate', { prompt });
      setRecipe(data);
      setModifyRequest('');
      setGenerating(false);
      fetchImageFor(data); // רץ ברקע - המתכון כבר מוצג ולא מחכים לתמונה
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה ביצירת המתכון');
      setGenerating(false);
    }
  };

  const handleModify = async (e) => {
    e.preventDefault();
    if (!modifyRequest.trim() || !recipe) return;

    setError('');
    setModifying(true);
    try {
      const { data } = await api.post('/recipes/modify', { recipe, request: modifyRequest });
      // המתכון השתנה, אז שומרים את התמונה הקיימת רק אם הכותרת לא השתנתה מהותית
      const keepImage = data.title === recipe.title ? recipe.imageUrl : '';
      setRecipe({ ...data, imageUrl: keepImage });
      setModifyRequest('');
      setModifying(false);
      if (!keepImage) fetchImageFor(data); // הכותרת השתנתה - מביאים תמונה מתאימה חדשה
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בעדכון המתכון');
      setModifying(false);
    }
  };

  const handleSave = async () => {
    if (!recipe) return;

    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/recipes/save', { recipe });
      sessionStorage.removeItem(DRAFT_KEY); // נשמר במסד - הטיוטה כבר לא נחוצה
      navigate(`/recipes/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשמירת המתכון');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <h2 className="text-4xl font-bold tracking-tight text-stone-900">מתכון בעזרת AI</h2>
        <p className="mt-3 font-light text-stone-500">
          תארו מה מתחשק לכם, וה-AI יחבר מתכון מלא. אפשר לבקש שינויים ואז לשמור.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="למשל: ארוחת ערב קטוגנית מהירה"
          maxLength={500}
          disabled={busy}
          className={inputClass}
        />
        <button type="submit" disabled={busy || !prompt.trim()} className={buttonClass}>
          {generating ? (
            <span className="flex items-center gap-2">
              <Spinner />
              ה-AI מבשל...
            </span>
          ) : (
            'צור מתכון'
          )}
        </button>
      </form>

      {!recipe && !generating && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-light text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-800"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>
      )}

      {generating && (
        <div className="mt-10 animate-pulse space-y-4" aria-hidden="true">
          <div className="h-8 w-1/2 rounded bg-stone-200" />
          <div className="h-4 w-3/4 rounded bg-stone-200" />
          <div className="h-4 w-2/3 rounded bg-stone-200" />
        </div>
      )}

      {recipe && !generating && (
        <article className="mt-10 overflow-hidden rounded-md border border-stone-200 bg-white">
          {/* התמונה מגיעה מעט אחרי המתכון (רצה ברקע), ולכן יש שלד טעינה בינתיים */}
          {recipe.imageUrl ? (
            // resolveImageUrl הופך נתיב יחסי מהשרת (/uploads/...) לכתובת מלאה (C4)
            <img
              src={resolveImageUrl(recipe.imageUrl)}
              alt={recipe.title}
              className="h-64 w-full object-cover sm:h-80"
            />
          ) : savingImage ? (
            <div className="flex h-64 w-full animate-pulse items-center justify-center bg-stone-200 sm:h-80">
              <span className="text-sm font-light text-stone-500">מכינים תמונה למנה...</span>
            </div>
          ) : null}

          <div className="p-8 sm:p-10">
          <h3 className="text-3xl font-bold tracking-tight text-stone-900">{recipe.title}</h3>
          {recipe.description && (
            <p className="mt-3 font-light leading-relaxed text-stone-500">{recipe.description}</p>
          )}
          <p className="mt-4 text-sm font-medium text-stone-400">
            {recipe.prepTime} דקות · {recipe.servings} מנות
          </p>

          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <h4 className="text-lg font-bold tracking-tight text-stone-900">מרכיבים</h4>
              <ul className="mt-3 divide-y divide-stone-200 border-t border-stone-200">
                {recipe.ingredients.map((ingredient, i) => (
                  <li key={i} className="py-2.5 font-light leading-relaxed text-stone-600">
                    {ingredient}
                  </li>
                ))}
              </ul>
            </div>

            <div className="sm:col-span-2">
              <h4 className="text-lg font-bold tracking-tight text-stone-900">אופן ההכנה</h4>
              <ol className="mt-3 space-y-4">
                {toSteps(recipe.instructions).map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-medium text-white">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 font-light leading-relaxed text-stone-600">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* עריכה בעזרת AI */}
          <div className="mt-10 border-t border-stone-200 pt-8">
            <h4 className="text-lg font-bold tracking-tight text-stone-900">רוצים לשנות משהו?</h4>
            <form onSubmit={handleModify} className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={modifyRequest}
                onChange={(e) => setModifyRequest(e.target.value)}
                placeholder="למשל: תעשה את זה חריף יותר / בלי מוצרי חלב"
                maxLength={500}
                disabled={busy}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={busy || !modifyRequest.trim()}
                className={buttonClass}
              >
                {modifying ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    מעדכן...
                  </span>
                ) : (
                  'עדכן מתכון'
                )}
              </button>
            </form>
          </div>

          {/* שמירה */}
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-stone-200 pt-8">
            {user ? (
              <button onClick={handleSave} disabled={busy} className={buttonClass}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    שומר...
                  </span>
                ) : (
                  'שמור למתכונים שלי'
                )}
              </button>
            ) : (
              <p className="font-light text-stone-500">
                כדי לשמור את המתכון צריך{' '}
                {/* מעבירים את המיקום הנוכחי כדי שאחרי ההתחברות נחזור לכאן,
                    והמתכון ישוחזר מ-sessionStorage (H8) */}
                <button
                  type="button"
                  onClick={() => navigate('/login', { state: { from: location } })}
                  className="font-medium text-stone-900 underline hover:text-stone-600"
                >
                  להתחבר
                </button>
                .
              </p>
            )}

            {recipe.imageUrl && (
              <button
                type="button"
                onClick={() => fetchImageFor(recipe)}
                disabled={busy}
                className="text-sm font-light text-stone-500 underline transition-colors hover:text-stone-900 disabled:opacity-60"
              >
                {savingImage ? 'מחליף תמונה...' : 'תמונה אחרת'}
              </button>
            )}
          </div>
          </div>
        </article>
      )}
    </div>
  );
}
