import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// NavLink מוסיף aria-current="page" אוטומטית - כאן רק מוסיפים הדגשה ויזואלית
const linkClass = ({ isActive }) =>
  `transition-colors duration-200 ${
    isActive ? 'font-medium text-stone-900' : 'font-light text-stone-500 hover:text-stone-900'
  }`;

const primaryButtonClass =
  'rounded-md bg-stone-900 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-stone-700';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // סוגר את התפריט בכל מעבר עמוד - אחרת הוא נשאר פתוח מעל התוכן החדש
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  // אותם קישורים משמשים גם בשורת הדסקטופ וגם בתפריט הנפתח,
  // כדי שלא ייווצר מצב שמוסיפים קישור באחד ושוכחים בשני
  const links = user
    ? [
        { to: '/ai', label: 'מתכון עם AI' },
        { to: '/my-recipes', label: 'המתכונים שלי' },
      ]
    : [{ to: '/ai', label: 'מתכון עם AI' }];

  return (
    <nav className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 md:px-10">
        <Link to="/" className="shrink-0 text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
          המתכונים שלי
        </Link>

        {/* דסקטופ */}
        <div className="hidden items-center gap-6 text-sm md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}

          {user ? (
            <>
              <Link to="/recipes/new" className={primaryButtonClass}>
                מתכון חדש
              </Link>
              <span className="font-light text-stone-500">
                שלום, <span className="font-medium text-stone-700">{user.name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="font-light text-stone-500 transition-colors duration-200 hover:text-stone-900"
              >
                התנתקות
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                התחברות
              </NavLink>
              <Link to="/register" className={primaryButtonClass}>
                הרשמה
              </Link>
            </>
          )}
        </div>

        {/* מובייל - כפתור המבורגר */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'סגירת התפריט' : 'פתיחת התפריט'}
          className="-me-2 rounded-md p-2 text-stone-700 transition-colors hover:bg-stone-100 md:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {/* מובייל - התפריט הנפתח */}
      {menuOpen && (
        <div id="mobile-menu" className="border-t border-stone-200 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4 text-sm">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            ))}

            {user ? (
              <>
                <Link to="/recipes/new" className={`${primaryButtonClass} text-center`}>
                  מתכון חדש
                </Link>
                <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                  <span className="font-light text-stone-500">
                    שלום, <span className="font-medium text-stone-700">{user.name}</span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="font-light text-stone-500 transition-colors duration-200 hover:text-stone-900"
                  >
                    התנתקות
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>
                  התחברות
                </NavLink>
                <Link to="/register" className={`${primaryButtonClass} text-center`}>
                  הרשמה
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
