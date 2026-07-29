import { Component } from 'react';

// רשת ביטחון אחרונה מפני מסך לבן (H7).
// כל שגיאה שנזרקת בזמן רינדור בעץ הרכיבים תיתפס כאן ותציג מסך הסבר
// במקום דף ריק לגמרי. חייב להיות class component - React לא מספק
// שקילות ב-hooks ל-componentDidCatch.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] שגיאת רינדור:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">משהו השתבש</h1>
          <p className="mt-3 font-light leading-relaxed text-stone-500">
            נתקלנו בתקלה בלתי צפויה בהצגת העמוד. אפשר לנסות לחזור לדף הבית.
          </p>

          {/* פרטי השגיאה נחשפים רק בפיתוח - למשתמש קצה זה רק רעש מבלבל */}
          {import.meta.env.DEV && (
            <pre className="mt-6 overflow-x-auto rounded-md bg-stone-100 p-4 text-start text-xs text-red-700">
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReload}
            className="mt-8 rounded-md bg-stone-900 px-6 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-stone-700"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }
}
