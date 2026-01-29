import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const categories = [
  { key: 'python_packages', labelZh: 'Python库', labelEn: 'Python Packages' },
  { key: 'tools', labelZh: '开源工具', labelEn: 'Open Source Tools' },
  { key: 'visualization', labelZh: '可视化项目', labelEn: 'Visualization Projects' },
  { key: 'echarts', labelZh: 'ECharts Demo', labelEn: 'ECharts Demo' },
];

export default function Projects() {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/projects/projects.json')
      .then(r => r.json())
      .then(data => { setProjects(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">{t('开源')}</h1>

      {categories.map((cat) => {
        const items = projects.filter(p => p.category === cat.key);
        if (items.length === 0) return null;

        return (
          <section key={cat.key} className="mb-10">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">
              {i18n.language === 'zh' ? cat.labelZh : cat.labelEn}
            </h2>
            <div className={`grid gap-4 ${
              cat.key === 'python_packages'
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {items.map((project) => (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow no-underline"
                >
                  <div className="aspect-video overflow-hidden bg-gray-100">
                    <img
                      src={project.image}
                      alt={i18n.language === 'zh' ? project.title_zh : project.title_en}
                      className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${
                        cat.key === 'python_packages' ? 'object-contain p-4' : 'object-cover'
                      }`}
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-slate-800">
                      {i18n.language === 'zh' ? project.title_zh : project.title_en}
                    </h3>
                    {(i18n.language === 'zh' ? project.description_zh : project.description_en) && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {i18n.language === 'zh' ? project.description_zh : project.description_en}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-sm text-gray-500 mt-4">
        <a href="https://github.com/ni1o1/echartsexamples" target="_blank" rel="noopener noreferrer" className="hover:text-black no-underline text-gray-500">
          ECharts source code →
        </a>
      </p>
    </div>
  );
}
