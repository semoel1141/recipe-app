import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const PAGE_SIZE = 12;

/**
 * לוגיקת רשימת מתכונים - חיפוש עם debounce, עימוד מצטבר ("טען עוד"),
 * וביטול בקשות שכבר לא רלוונטיות.
 *
 * משותף לעמוד "כל המתכונים" ולעמוד "המתכונים שלי" - ההבדל היחיד ביניהם
 * הוא הדגל mine, ואין סיבה לשכפל את כל הלוגיקה פעמיים.
 *
 * @param {{ mine?: boolean }} options
 */
export function useRecipeList({ mine = false } = {}) {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // מחזיק את ה-controller של הבקשה הפעילה, כדי לבטל אותה כשיוצאת חדשה
  const activeRequest = useRef(null);

  // חיפוש חדש תמיד מאפס לעמוד הראשון, אחרת נשארים תקועים בעמוד 3 של תוצאות ישנות
  useEffect(() => {
    setPage(1);
  }, [search, mine]);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    activeRequest.current = controller;

    // debounce רק על הקלדה בחיפוש; מעבר עמוד צריך להיות מיידי
    const delay = search ? 300 : 0;

    const timeoutId = setTimeout(() => {
      api
        .get('/recipes', {
          params: {
            search: search || undefined,
            mine: mine ? 'true' : undefined,
            page,
            limit: PAGE_SIZE,
          },
          signal: controller.signal,
        })
        .then(({ data }) => {
          // עמוד 1 מחליף את הרשימה; עמוד 2+ מוסיף אליה ("טען עוד")
          setRecipes((prev) => (page === 1 ? data.recipes : [...prev, ...data.recipes]));
          setTotal(data.total);
          setPages(data.pages);
          setError('');
        })
        .catch((err) => {
          if (err.name === 'CanceledError') return;
          setError(err.response?.data?.message || 'שגיאה בטעינת מתכונים');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search, page, mine]);

  const loadMore = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return {
    recipes,
    search,
    setSearch,
    loading,
    error,
    total,
    hasMore: page < pages,
    loadMore,
    // טעינה ראשונית (אין מה להציג) לעומת רענון (יש תוצאות על המסך)
    isInitialLoading: loading && recipes.length === 0,
    isRefreshing: loading && recipes.length > 0,
  };
}
