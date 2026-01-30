import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-10"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-video bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pythonPackages = projects.filter(p => p.category === 'python_packages');
  const tools = projects.filter(p => p.category === 'tools');
  const visualization = projects.filter(p => p.category === 'visualization');
  const echarts = projects.filter(p => p.category === 'echarts');

  const ProjectCard = ({ project, size = 'normal' }) => {
    const title = i18n.language === 'zh' ? project.title_zh : project.title_en;
    const description = i18n.language === 'zh' ? project.description_zh : project.description_en;

    return (
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block no-underline"
      >
        <div className={`relative overflow-hidden rounded-lg bg-slate-100 ${
          size === 'large' ? 'aspect-[4/3]' : 'aspect-video'
        }`}>
          <img
            src={project.image}
            alt={title}
            className={`w-full h-full transition-transform duration-500 group-hover:scale-105 ${
              project.category === 'python_packages' ? 'object-contain p-6' : 'object-cover'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-white text-sm font-medium line-clamp-2">{title}</p>
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
            {title}
          </h3>
          {description && size !== 'small' && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </a>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-12">{t('开源')}</h1>

      {/* Python Packages - Logo on top, text below */}
      {pythonPackages.length > 0 && (
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-slate-700 mb-6 flex items-center gap-3">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            {i18n.language === 'zh' ? 'Python库' : 'Python Packages'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pythonPackages.map((project) => {
              const title = i18n.language === 'zh' ? project.title_zh : project.title_en;
              const description = i18n.language === 'zh' ? project.description_zh : project.description_en;
              return (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block no-underline"
                >
                  <div className="h-28 flex items-center justify-center bg-white rounded-lg">
                    <img
                      src={project.image}
                      alt={title}
                      className="max-w-[85%] max-h-20 object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="mt-3">
                    <h3 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                      {title}
                    </h3>
                    {description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Tools Section */}
      {tools.length > 0 && (
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-slate-700 mb-6 flex items-center gap-3">
            <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
            {i18n.language === 'zh' ? '开源工具' : 'Open Source Tools'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tools.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Visualization Projects */}
      {visualization.length > 0 && (
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-slate-700 mb-6 flex items-center gap-3">
            <span className="w-1 h-6 bg-violet-500 rounded-full"></span>
            {i18n.language === 'zh' ? '可视化项目' : 'Visualization Projects'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {visualization.map((project) => (
              <ProjectCard key={project.id} project={project} size="small" />
            ))}
          </div>
        </section>
      )}

      {/* ECharts Demo */}
      {echarts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-700 mb-6 flex items-center gap-3">
            <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
            ECharts Demo
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {echarts.map((project) => {
              const title = i18n.language === 'zh' ? project.title_zh : project.title_en;
              return (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block no-underline"
                >
                  <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={project.image}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <h3 className="text-xs text-slate-600 mt-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {title}
                  </h3>
                </a>
              );
            })}
          </div>
          <p className="text-sm text-slate-500 mt-6">
            <a
              href="https://github.com/ni1o1/echartsexamples"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-800 no-underline text-slate-500 transition-colors"
            >
              {i18n.language === 'zh' ? '查看源代码' : 'View source code'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
