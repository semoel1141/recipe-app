import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../utils/imageUrl';

// תמונת מתכון עם נפילה חיננית לפלייסהולדר עדין אם אין קישור או שהטעינה נכשלה
export default function RecipeImage({ src, alt, className = '', loading = 'lazy' }) {
  const resolved = resolveImageUrl(src);
  const [broken, setBroken] = useState(false);

  // מאפסים את מצב ה"שבור" בכל פעם שהמקור משתנה (H5).
  // בלי זה, אחרי כישלון טעינה אחד אותו מופע רכיב היה מציג פלייסהולדר לנצח -
  // גם כשמגיעה כתובת תקינה חדשה (למשל בכפתור "תמונה אחרת" או בסינון החיפוש).
  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  if (!resolved || broken) {
    return (
      <div className={`flex items-center justify-center bg-stone-200 ${className}`} role="img" aria-label={alt}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="h-10 w-10 text-stone-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 3v6a2.25 2.25 0 002.25 2.25v0M8.25 3v0M8.25 3a2.25 2.25 0 00-2.25 2.25v3.75a2.25 2.25 0 002.25 2.25M10.5 11.25V21M15.75 3v18M15.75 3c-1.657 0-3 1.679-3 4.5s1.343 4.5 3 4.5"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      loading={loading}
      onError={() => setBroken(true)}
      className={`object-cover ${className}`}
    />
  );
}
