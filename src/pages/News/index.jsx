import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ViewCounter from '../../ViewCounter';
import LikeDislike from '../../LikeDislike';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function News() {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const { t, i18n } = useTranslation();
  const [statsMap, setStatsMap] = useState({ views: new Map(), ratings: new Map() });
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    fetch('/posts/index.json')
      .then(r => r.json())
      .then(setNews)
      .catch(() => setNews([]));
  }, []);

  useEffect(() => {
    if (news.length === 0) return;
    const itemIds = news.map(item => item.filename);

    const fetchStats = async () => {
      try {
        // Batch fetch views
        const viewsResponse = await fetch(`${API_BASE}/api/views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds })
        });
        const viewsData = await viewsResponse.json();
        const newViewsMap = new Map(Object.entries(viewsData));

        // Batch fetch ratings
        const ratingsResponse = await fetch(`${API_BASE}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds })
        });
        const ratingsData = await ratingsResponse.json();
        const newRatingsMap = new Map(Object.entries(ratingsData).map(([key, val]) => [key, {
          likes: val.likes || 0
        }]));

        setStatsMap({ views: newViewsMap, ratings: newRatingsMap });
      } catch (error) {
        console.error("Failed to batch fetch stats:", error);
      }
    };
    fetchStats();
  }, [news]);

  const totalPages = Math.ceil(news.length / pageSize);
  const paginatedNews = news.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">{t('新闻')}</h1>
      <div className="space-y-6">
        {paginatedNews.map((item) => {
          const views = statsMap.views.get(item.filename) || 0;
          const ratings = statsMap.ratings.get(item.filename) || { likes: 0 };

          return (
            <article key={item.filename} className="group">
              <div className="flex items-baseline gap-3 mb-1">
                <time className="text-xs text-gray-400 font-mono whitespace-nowrap">{item.date}</time>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <ViewCounter views={views} />
                  <LikeDislike
                    itemId={item.filename}
                    initialLikes={ratings.likes}
                  />
                </div>
              </div>
              <a
                onClick={() => navigate(`/news/${item.filename}`)}
                className="text-base font-medium text-slate-800 hover:text-blue-600 cursor-pointer transition-colors no-underline"
              >
                {i18n.language === 'zh' ? item.title_zh : item.title_en}
              </a>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {i18n.language === 'zh' ? item.brief_zh : item.brief_en}
              </p>
              {item.tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {t(tag)}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm border-none cursor-pointer transition-colors ${
                p === page
                  ? 'bg-slate-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
