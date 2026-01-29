import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

export default function Publication() {
  const [markdown, setMarkdown] = useState('');
  const { t, i18n } = useTranslation();

  const processMarkdownContent = (content) => {
    if (i18n.language === 'en') {
      return content
        .replace(/论著/g, t('论著') || 'Publications')
        .replace(/期刊与会议论文/g, t('期刊与会议论文') || 'Journal Papers')
        .replace(/期刊/g, t('期刊') || 'Journal')
        .replace(/会议论文/g, t('会议论文') || 'Conference Papers')
        .replace(/专著/g, t('专著') || 'Books')
        .replace(/章节/g, t('章节') || 'Book Chapters');
    }
    return content;
  };

  useEffect(() => {
    import('./content.md')
      .then(res => fetch(res.default))
      .then(response => response.text())
      .then(text => setMarkdown(processMarkdownContent(text)));
  }, [i18n.language]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {markdown ? (
        <article className="prose prose-slate prose-sm max-w-none">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </article>
      ) : (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      )}
    </div>
  );
}
