import { useRecipeList } from '../hooks/useRecipeList';
import RecipeGrid from '../components/RecipeGrid';
import SearchInput from '../components/SearchInput';

export default function RecipeList() {
  const { recipes, search, setSearch, error, total, hasMore, loadMore, isInitialLoading, isRefreshing } =
    useRecipeList();

  return (
    <div>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">כל המתכונים</h2>
        <p className="mt-3 font-light text-stone-500">מתכונים אמיתיים, בלי סיפורי חיים לפני ההוראות.</p>
        <SearchInput value={search} onChange={setSearch} />
      </div>

      {/* השגיאה מוצגת מעל הרשימה במקום להחליף אותה - כך תקלת רשת חד-פעמית
          לא "מוחקת" את כל העמוד עד לרענון ידני (H2) */}
      {error && (
        <p role="alert" className="mt-8 rounded-md bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      {!error && (
        <RecipeGrid
          recipes={recipes}
          total={total}
          isInitialLoading={isInitialLoading}
          isRefreshing={isRefreshing}
          hasMore={hasMore}
          onLoadMore={loadMore}
          emptyMessage={
            search ? 'לא נמצאו מתכונים תואמים.' : 'עדיין אין מתכונים. היו הראשונים להוסיף אחד!'
          }
        />
      )}
    </div>
  );
}
