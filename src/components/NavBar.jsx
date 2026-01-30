import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const navItems = [
  { path: '/', labelZh: '首页', labelEn: 'Home' },
  { path: '/news', labelZh: '新闻', labelEn: 'News' },
  { path: '/research', labelZh: '研究', labelEn: 'Research' },
  { path: '/publication', labelZh: '论著', labelEn: 'Publications' },
  { path: '/projects', labelZh: '开源', labelEn: 'Open Source' },
  { path: '/team', labelZh: '团队', labelEn: 'Team' },
];

export default function NavBar() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/intro';
    return location.pathname.startsWith(path);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Name / Logo */}
          <Link to="/" className="text-lg font-semibold text-slate-800 no-underline hover:text-black">
            {i18n.language === 'zh' ? '余庆' : 'Yu Qing'}
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm no-underline transition-colors ${
                  isActive(item.path)
                    ? 'text-black font-medium border-b-2 border-black pb-0.5'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {i18n.language === 'zh' ? item.labelZh : item.labelEn}
              </Link>
            ))}
            <button
              onClick={toggleLang}
              className="text-sm text-gray-500 hover:text-black bg-transparent border-none cursor-pointer px-2 py-1"
            >
              {i18n.language === 'en' ? '中文' : 'English'}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden bg-transparent border-none cursor-pointer p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`block py-2 text-sm no-underline ${
                  isActive(item.path)
                    ? 'text-black font-medium'
                    : 'text-gray-500'
                }`}
              >
                {i18n.language === 'zh' ? item.labelZh : item.labelEn}
              </Link>
            ))}
            <button
              onClick={() => { toggleLang(); setMenuOpen(false); }}
              className="block w-full text-left py-2 text-sm text-gray-500 hover:text-black bg-transparent border-none cursor-pointer"
            >
              {i18n.language === 'en' ? '中文' : 'English'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
