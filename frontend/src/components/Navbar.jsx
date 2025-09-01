import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import SearchDropdown from './SearchDropdown';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);
  // Scroll-aware navbar state
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  // Animate-in state for floating action button (FAB)
  const [fabIn, setFabIn] = useState(false);
  // Profile submenu inside floating menu
  const [showProfileSubmenu, setShowProfileSubmenu] = useState(false);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleGlobalDown = (event) => {
      if (isMenuOpen && !event.target.closest('.mobile-menu')) {
        setIsMenuOpen(false);
      }
      if (showProfileMenu && profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        setIsMenuOpen(false);
        setShowFloatingMenu(false);
        setShowProfileSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleGlobalDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMenuOpen, showProfileMenu]);

  // Auto-close all menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setShowProfileMenu(false);
    setShowFloatingMenu(false);
  }, [location.pathname]);

  // Auto-close menus on auth user change (e.g., logout/login)
  useEffect(() => {
    setIsMenuOpen(false);
    setShowProfileMenu(false);
    setShowFloatingMenu(false);
  }, [user]);

  // Detect scroll direction to hide/show navbar
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const last = lastScrollY.current;
      const delta = y - last;
      // Threshold to avoid jitter
      if (y > 40 && delta > 5) {
        setIsScrollingDown(true);
      } else if (delta < -5) {
        setIsScrollingDown(false);
      }
      // Close any open menus on meaningful scroll movement
      if (Math.abs(delta) > 5) {
        setShowFloatingMenu(false);
        setShowProfileSubmenu(false);
      }
      // Only show full navbar when at the very top
      setAtTop(y <= 10);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Also close menus when scroll direction toggles
  useEffect(() => {
    setShowFloatingMenu(false);
    setShowProfileMenu(false);
  }, [isScrollingDown]);

  // When returning to top (full navbar visible), ensure floating and profile menus are closed
  useEffect(() => {
    if (atTop) {
      setShowFloatingMenu(false);
      setShowProfileMenu(false);
      setShowProfileSubmenu(false);
      setFabIn(false);
    } else {
      // Delay to allow mount before animating in
      const id = requestAnimationFrame(() => setFabIn(true));
      return () => cancelAnimationFrame(id);
    }
  }, [atTop]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSearchFocus = () => {
    setShowSearchDropdown(true);
  };

  const handleSearchBlur = (e) => {
    // Delay hiding to allow clicking on dropdown items
    setTimeout(() => {
      if (!searchRef.current?.contains(document.activeElement)) {
        setShowSearchDropdown(false);
      }
    }, 200);
  };

  return (
    <>
      {/* Dynamic Island Style Navbar (only visible at top) */}
      <nav
        className={`dynamic-island transition-all duration-300 ease-out ${
          atTop
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-6 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-4">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center hover:scale-105 transition-transform duration-200"
          >
                <img src="/urban_nest-logo.png" alt="UrbanNest Logo" className="h-16 mr-16" style={{display: 'inline-block', height: '3rem', width: 'auto', objectFit: 'contain'}} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search properties, owners, tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  className="w-48 lg:w-64 xl:w-72 pl-4 pr-4 py-2 bg-white/80 dark:bg-neutral-800/80 border border-white/30 dark:border-neutral-700/50 rounded-full text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                />
              </div>
              {showSearchDropdown && (
                <SearchDropdown 
                  query={searchQuery} 
                  onClose={() => setShowSearchDropdown(false)}
                />
              )}
            </div>

            {/* Navigation Links */}
            <Link
              to="/properties"
              className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
            >
              Properties
            </Link>
            <Link
              to="/map"
              className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
            >
              Map
            </Link>
            {user && (
              <Link
                to="/notifications"
                className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
              >
                Notifications
              </Link>
            )}
            <Link
              to="/owners"
              className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
            >
              Owners
            </Link>
            <Link
              to="/tenants"
              className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
            >
              Tenants
            </Link>
            {user?.role === 'tenant' && (
              <Link
                to="/favourites"
                className="px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
              >
                Favourites
              </Link>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Menu */}
            {user ? (
              <div className="flex items-center space-x-3">
                <Link
                  to="/dashboard"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-cyan-400/60"
                >
                  Dashboard
                </Link>
                {/* Authenticated users should not see Sign Up here */}
                <div
                  className="relative"
                  ref={profileRef}
                >
                  <button
                    onClick={() => setShowProfileMenu((v) => !v)}
                    className="flex items-center justify-center h-9 w-9 rounded-full border border-white/30 dark:border-neutral-700 overflow-hidden bg-neutral-200 dark:bg-neutral-700 hover:ring-2 hover:ring-cyan-400/60"
                    title={user?.name || 'Profile'}
                    aria-haspopup="menu"
                    aria-expanded={showProfileMenu}
                  >
                    {user?.profileImage ? (
                      <img src={user.profileImage} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                        {(user?.name || 'U')
                          .split(' ')
                          .map(s => s[0])
                          .join('')
                          .slice(0,2)
                          .toUpperCase()}
                      </span>
                    )}
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 border border-white/30 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-white/30 dark:border-neutral-700 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                          {user?.profileImage ? (
                            <img src={user.profileImage} alt="avatar" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                              {(user?.name || 'U')
                                .split(' ')
                                .map(s => s[0])
                                .join('')
                                .slice(0,2)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{user?.name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => { navigate('/profile-status'); setShowProfileMenu(false); }}
                          className="w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                        >
                          Profile Status
                        </button>
                        <button
                          onClick={() => { navigate('/profile-settings'); setShowProfileMenu(false); }}
                          className="w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                        >
                          Settings
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2 text-sm text-error-700 dark:text-error-400 hover:bg-error-50/60 dark:hover:bg-error-900/20 text-left"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-full transition-all duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap inline-flex"
                >
                  {"Sign\u00A0Up"}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden px-3 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all duration-200"
          >
            {isMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </nav>

      {/* Floating round button (top-right) when not at top */}
      {!atTop && (
        <>
          <button
            onClick={() => setShowFloatingMenu((v) => !v)}
            className={`fixed top-4 right-4 z-[60] h-10 w-10 rounded-full bg-cyan-600 text-white shadow-xl hover:bg-cyan-700 transition-all duration-300 ease-out ring-2 ring-cyan-400/30 drop-shadow-[0_8px_16px_rgba(34,211,238,0.35)] ${
              showFloatingMenu ? 'scale-110 drop-shadow-[0_10px_20px_rgba(34,211,238,0.45)]' : 'scale-100'
            } ${fabIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            title="Open Menu"
            aria-label="Open Menu"
          >
            {/* Simple hamburger */}
            <span className="block w-5 h-0.5 bg-white mx-auto mb-1.5 rounded"></span>
            <span className="block w-5 h-0.5 bg-white mx-auto mb-1.5 rounded"></span>
            <span className="block w-5 h-0.5 bg-white mx-auto rounded"></span>
          </button>

          {/* Removed fixed profile menu in transformed state per request */}

          {/* Vertical menu panel opened by floating button */}
          {showFloatingMenu && (
            <div className="fixed top-20 right-4 z-[55] w-64 max-h-[70vh] overflow-auto rounded-2xl border shadow-xl p-4 animate-slide-up bg-white/98 dark:bg-neutral-900/98 border-white/30 dark:border-neutral-700/70 backdrop-blur-xl">
              <div className="space-y-2">
                <Link to="/" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Home</Link>
                <Link to="/properties" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Properties</Link>
                <Link to="/map" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Map</Link>
                <Link to="/owners" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Owners</Link>
                <Link to="/tenants" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Tenants</Link>
                {user?.role === 'tenant' && (
                  <Link to="/favourites" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Favourites</Link>
                )}
                {user && (
                  <Link to="/notifications" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">Notifications</Link>
                )}
                <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />
                {user ? (
                  <>
                    {/* Profile submenu */}
                    <button
                      onClick={() => setShowProfileSubmenu((v) => !v)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-cyan-600 dark:text-cyan-400"
                      aria-expanded={showProfileSubmenu}
                      aria-controls="profile-submenu"
                    >
                      Profile
                    </button>
                    {showProfileSubmenu && (
                      <div id="profile-submenu" className="pl-3 space-y-1">
                        <button
                          onClick={() => { navigate('/profile-status'); setShowFloatingMenu(false); setShowProfileSubmenu(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200"
                        >
                          Profile Status
                        </button>
                        <button
                          onClick={() => { navigate('/profile-settings'); setShowFloatingMenu(false); setShowProfileSubmenu(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200"
                        >
                          Settings
                        </button>
                        <button
                          onClick={async () => { await logout(); navigate('/'); setShowFloatingMenu(false); setShowProfileSubmenu(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-error-50/60 dark:hover:bg-error-900/20 text-sm font-medium text-error-700 dark:text-error-400"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                    <Link to="/dashboard" onClick={() => { setShowFloatingMenu(false); setShowProfileSubmenu(false); }} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-cyan-600 dark:text-cyan-400">Dashboard</Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-cyan-600 dark:text-cyan-400">Login</Link>
                    <Link to="/register" onClick={() => setShowFloatingMenu(false)} className="block px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{"Sign\u00A0Up"}</Link>
                  </>
                )}
                <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-2" />
                <button onClick={() => { toggleTheme(); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="mobile-menu fixed top-16 left-4 right-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-neutral-700/50 p-6 z-40 md:hidden animate-slide-up">
          {/* Mobile Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-4 pr-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Mobile Navigation Links */}
          <div className="space-y-4">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
            >
              Home
            </Link>
            <Link
              to="/properties"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
            >
              Properties
            </Link>
            <Link
              to="/map"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
            >
              Map
            </Link>
            {user && (
              <Link
                to="/notifications"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
              >
                Notifications
              </Link>
            )}

            <Link
              to="/owners"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
            >
              Owners
            </Link>
            <Link
              to="/tenants"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
            >
              Tenants
            </Link>
            {user?.role === 'tenant' && (
              <Link
                to="/favourites"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
              >
                Favourites
              </Link>
            )}

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 w-full text-left font-medium text-error-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all duration-200 font-medium text-center whitespace-nowrap inline-flex"
                >
                  {"Sign\u00A0Up"}
                </Link>
              </>
            )}

            {/* Theme Toggle */}
            <button
              onClick={() => {
                toggleTheme();
                setIsMenuOpen(false);
              }}
              className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 w-full text-left"
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;