import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-7xl font-bold tracking-tight text-stone-200">404</p>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-stone-900">העמוד לא נמצא</h2>
      <p className="mt-3 font-light leading-relaxed text-stone-500">
        הקישור שהגעתם דרכו כנראה שבור, או שהמתכון הועבר למקום אחר.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700"
        >
          לכל המתכונים
        </Link>
        <Link
          to="/ai"
          className="rounded-md border border-stone-300 px-6 py-2.5 font-medium text-stone-700 transition-colors duration-200 hover:border-stone-400 hover:bg-stone-50"
        >
          ✨ יצירת מתכון עם AI
        </Link>
      </div>
    </div>
  );
}
