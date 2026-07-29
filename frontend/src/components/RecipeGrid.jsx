import { Link } from 'react-router-dom';
import RecipeImage from './RecipeImage';

function GridSkeleton() {
  return (
    <div className="mt-10 grid animate-pulse grid-cols-2 gap-1 md:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] bg-stone-200" />
      ))}
    </div>
  );
}

/**
 * רשת כרטיסי המתכונים - משותפת לעמוד "כל המתכונים" ולעמוד "המתכונים שלי".
 */
export default function RecipeGrid({
  recipes,
  total,
  isInitialLoading,
  isRefreshing,
  hasMore,
  onLoadMore,
  emptyMessage,
}) {
  if (isInitialLoading) return <GridSkeleton />;

  if (recipes.length === 0) {
    return <p className="mt-16 text-center font-light text-stone-500">{emptyMessage}</p>;
  }

  return (
    <div className={isRefreshing ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      <p className="mt-10 text-sm font-medium text-stone-400">
        {recipes.length < total ? `${recipes.length} מתוך ${total}` : `${total} סה"כ`}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1 md:grid-cols-4">
        {recipes.map((recipe) => (
          <Link
            to={`/recipes/${recipe._id}`}
            key={recipe._id}
            className="group relative block aspect-[3/4] overflow-hidden bg-stone-200"
          >
            <RecipeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

            {/* תג למתכונים שנוצרו ב-AI - השדה קיים במודל מההתחלה אבל לא הוצג בשום מקום */}
            {recipe.aiGenerated && (
              <span className="absolute end-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-700 backdrop-blur-sm">
                ✨ AI
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 p-4 text-center">
              <h3 className="text-base font-bold text-white sm:text-lg">{recipe.title}</h3>
              {recipe.prepTime > 0 && (
                <p className="mt-1 text-sm font-light text-white/80">{recipe.prepTime} דקות</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={onLoadMore}
            disabled={isRefreshing}
            className="rounded-md border border-stone-300 px-6 py-2.5 font-medium text-stone-700 transition-colors duration-200 hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? 'טוען...' : 'טען עוד מתכונים'}
          </button>
        </div>
      )}
    </div>
  );
}
