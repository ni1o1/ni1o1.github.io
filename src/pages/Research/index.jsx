import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AV from 'leancloud-storage';
import LikeDislike from '../../LikeDislike';

export default function ResearchPage() {
  const { t, i18n } = useTranslation();
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [researchData, setResearchData] = useState([]);
  const [filteredResearch, setFilteredResearch] = useState([]);
  const [allKeywords, setAllKeywords] = useState([]);
  const [keywordCounts, setKeywordCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [ratingsMap, setRatingsMap] = useState(new Map());

  useEffect(() => {
    const fetchResearchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/research/index.json');
        const data = await response.json();
        setResearchData(data);
        setFilteredResearch(data);

        const counts = data.flatMap(item => item.keywords).reduce((acc, keyword) => {
          acc[keyword] = (acc[keyword] || 0) + 1;
          return acc;
        }, {});
        setKeywordCounts(counts);
        const keywords = [...new Set(data.flatMap(item => item.keywords))]
          .sort((a, b) => counts[b] - counts[a]);
        setAllKeywords(keywords);
      } catch (error) {
        console.error('Failed to load research data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchResearchData();
  }, []);

  useEffect(() => {
    const itemIds = researchData.map(item => item.id);
    if (itemIds.length === 0) return;
    const fetchAllRatings = async () => {
      try {
        const query = new AV.Query('Ratings');
        query.containedIn('itemId', itemIds);
        query.limit(1000);
        const results = await query.find();
        const newRatingsMap = new Map(results.map(item => [item.get('itemId'), {
          likes: item.get('likes') || 0,
          objectId: item.id
        }]));
        setRatingsMap(newRatingsMap);
      } catch (error) {
        console.error("Failed to batch fetch ratings:", error);
      }
    };
    fetchAllRatings();
  }, [researchData]);

  useEffect(() => {
    if (selectedKeywords.length > 0) {
      setFilteredResearch(
        researchData.filter(item =>
          selectedKeywords.some(keyword => item.keywords.includes(keyword))
        )
      );
    } else {
      setFilteredResearch(researchData);
    }
  }, [selectedKeywords, researchData]);

  const toggleKeyword = (kw) => {
    setSelectedKeywords(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('研究')}</h1>

      {/* Keyword filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {allKeywords.map((kw) => (
          <button
            key={kw}
            onClick={() => toggleKeyword(kw)}
            className={`text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${
              selectedKeywords.includes(kw)
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {t(kw)} ({keywordCounts[kw]})
          </button>
        ))}
      </div>

      {/* Research grid */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredResearch.map((item) => {
            const ratingData = ratingsMap.get(item.id) || { likes: 0, objectId: null };
            return (
              <div key={item.id} className="flex flex-col sm:flex-row gap-6">
                <a
                  href={item.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 group"
                >
                  <div className="w-full sm:w-48 aspect-video overflow-hidden bg-gray-100 flex items-center justify-center">
                    <img
                      src={item.imgpath}
                      alt={i18n.language === 'zh' ? item.title_zh : item.title_en}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </a>
                <div className="flex-1">
                  <a
                    href={item.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    <h3 className="text-base font-medium text-slate-800 hover:text-blue-600 transition-colors mb-2">
                      {i18n.language === 'zh' ? item.title_zh : item.title_en}
                    </h3>
                  </a>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {i18n.language === 'zh' ? item.description : item.description_en}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {item.keywords?.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {t(tag)}
                        </span>
                      ))}
                    </div>
                    <div onClick={(e) => e.preventDefault()}>
                      <LikeDislike
                        itemId={item.id}
                        initialLikes={ratingData.likes}
                        objectId={ratingData.objectId}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
