import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import AV from 'leancloud-storage';
import { useTranslation } from 'react-i18next';
import ViewCounter from '../../ViewCounter';
import LikeDislike from '../../LikeDislike';

export default function NewsDetail() {
  const navigate = useNavigate();
  const { filename } = useParams();
  const [content, setContent] = useState('');
  const [ratingData, setRatingData] = useState({ likes: 0, dislikes: 0, objectId: null });
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const loadPostContent = async () => {
      try {
        const langDir = i18n.language === 'zh' ? 'zh' : 'en';
        const postModules = import.meta.glob('/public/posts/**/*.md', { as: 'raw' });
        const postPath = `/public/posts/${langDir}/${filename}.md`;

        if (postModules[postPath]) {
          const raw = await postModules[postPath]();
          const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
          setContent(raw.replace(frontMatterRegex, ''));
        } else {
          setContent("# Article Not Found");
        }
      } catch (err) {
        console.error("Failed to load post content:", err);
        setContent("# Article Not Found");
      }
    };
    if (filename) loadPostContent();
  }, [filename, i18n.language]);

  useEffect(() => {
    if (!filename) return;
    const ratingQuery = new AV.Query('Ratings');
    ratingQuery.equalTo('itemId', filename);
    ratingQuery.first().then(result => {
      if (result) {
        setRatingData({
          likes: result.get('likes') || 0,
          dislikes: result.get('dislikes') || 0,
          objectId: result.id,
        });
      }
    }).catch(console.error);
  }, [filename]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/news')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black bg-transparent border-none cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {i18n.language === 'zh' ? '返回' : 'Back'}
        </button>
        <ViewCounter itemId={filename} increment={true} />
        <LikeDislike
          itemId={filename}
          initialLikes={ratingData.likes}
          initialDislikes={ratingData.dislikes}
          objectId={ratingData.objectId}
        />
      </div>

      {/* Content */}
      {content ? (
        <article className="prose prose-slate max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      ) : (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      )}

      {/* Bottom rating */}
      {content && (
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-center gap-3">
          <span className="text-sm text-gray-500">{t("你觉得这项研究怎么样？")}</span>
          <LikeDislike
            itemId={filename}
            initialLikes={ratingData.likes}
            initialDislikes={ratingData.dislikes}
            objectId={ratingData.objectId}
          />
        </div>
      )}
    </div>
  );
}
