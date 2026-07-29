export default function SearchInput({ value, onChange, placeholder = 'חיפוש לפי שם מתכון או מרכיב...' }) {
  return (
    <div className="relative mt-8">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4-4" />
      </svg>
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-stone-100 py-3 pe-4 ps-11 text-stone-700 transition-colors placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none"
      />
    </div>
  );
}
