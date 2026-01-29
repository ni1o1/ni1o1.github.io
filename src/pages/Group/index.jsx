import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

export default function Group() {
  const [markdown, setMarkdown] = useState('');
  const { i18n } = useTranslation();

  useEffect(() => {
    import(`./content_${i18n.language}.md`)
      .then(res => fetch(res.default))
      .then(response => response.text())
      .then(text => setMarkdown(text));
  }, [i18n.language]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {markdown ? (
        <article className="prose prose-slate max-w-none">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </article>
      ) : (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      )}
    </div>
  );
}
