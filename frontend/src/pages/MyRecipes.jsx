import { Link } from 'react-router-dom';
import { useRecipeList } from '../hooks/useRecipeList';
import { useAuth } from '../hooks/useAuth';
import RecipeGrid from '../components/RecipeGrid';
import SearchInput from '../components/SearchInput';

export default function MyRecipes() {
  const { user } = useAuth();
  const { recipes, search, setSearch, error, total, hasMore, loadMore, isInitialLoading, isRefreshing } =
    useRecipeList({ mine: true });

  return (
    <div>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">המתכונים שלי</h2>
        <p className="mt-3 font-light text-stone-500">
          כל מה ש{user?.name ? `${user.name} ` : ''}יצר או שמר כאן.
        </p>
        <SearchInput value={search} onChange={setSearch} placeholder="חיפוש במתכונים שלי..." />
      </div>

      {error && (
        <p role="alert" className="mt-8 rounded-md bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      {!error && (
        <>
          <RecipeGrid
            recipes={recipes}
            total={total}
            isInitialLoading={isInitialLoading}
            isRefreshing={isRefreshing}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyMessage={
              search ? 'לא נמצאו מתכונים תואמים.' : 'עדיין לא יצרת מתכונים.'
            }
          />

          {/* מצב ריק אמיתי (בלי חיפוש פעיל) - מפנים לפעולה במקום להשאיר מסך מת */}
          {!isInitialLoading && recipes.length === 0 && !search && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/recipes/new"
                className="rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700"
              >
                כתיבת מתכון חדש
              </Link>
              <Link
                to="/ai"
                className="rounded-md border border-stone-300 px-6 py-2.5 font-medium text-stone-700 transition-colors duration-200 hover:border-stone-400 hover:bg-stone-50"
              >
                ✨ יצירת מתכון עם AI
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
