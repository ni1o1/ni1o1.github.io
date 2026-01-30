import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const { t, i18n } = useTranslation();
  const [intro, setIntro] = useState('');
  const [news, setNews] = useState([]);
  const [research, setResearch] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    import(`../Introduction/content_${i18n.language}.md`)
      .then(res => fetch(res.default))
      .then(r => r.text())
      .then(setIntro);
  }, [i18n.language]);

  useEffect(() => {
    fetch('/posts/index.json')
      .then(r => r.json())
      .then(posts => setNews(posts.slice(0, 5)))
      .catch(() => setNews([]));
  }, []);

  useEffect(() => {
    fetch('/research/index.json')
      .then(r => r.json())
      .then(data => setResearch(data.filter(d => d.show).slice(0, 4)))
      .catch(() => setResearch([]));
  }, []);

  useEffect(() => {
    fetch('/projects/projects.json')
      .then(r => r.json())
      .then(data => {
        const selectedIds = ['transbigdata', 'solar-real-scene', 'smart-ev', 'urban-accessibility'];
        const selected = selectedIds.map(id => data.find(p => p.id === id)).filter(Boolean);
        setProjects(selected);
      })
      .catch(() => setProjects([]));
  }, []);

  const books = [
    {
      title_zh: '交通时空大数据分析、挖掘与可视化',
      title_en: 'Transportation Spatiotemporal Big Data Analysis, Mining and Visualization',
      description_zh: '本书系统梳理交通时空大数据分析所需的跨学科技能，涵盖Python数据处理、网络爬虫、地理信息、数据可视化等基础知识，并结合出租车GPS、地铁IC卡、共享单车等真实案例，由浅入深地介绍数据挖掘与机器学习方法在交通领域的应用。',
      description_en: 'A comprehensive guide to transportation spatiotemporal big data analysis, covering Python data processing, web scraping, GIS, and visualization. Features real-world cases including taxi GPS, metro smart card, and bike-sharing data, with in-depth coverage of data mining and machine learning methods.',
      url: 'http://www.tup.tsinghua.edu.cn/booksCenter/book_09389001.html',
      image: 'images/book1.jpg'
    },
    {
      title_zh: '交通时空大数据详解：车辆轨迹数据分析、挖掘与可视化（Python版）',
      title_en: 'Transportation Spatiotemporal Big Data: Vehicle Trajectory Data Analysis, Mining and Visualization (Python)',
      description_zh: '本书在前作基础上深入聚焦车辆轨迹数据，结合作者开发维护TransBigData开源库的实践经验，系统讲解轨迹数据的预处理、分析挖掘与可视化方法，为交通大数据研究与应用提供专业指导。',
      description_en: 'Building on the foundation of the first book, this volume focuses specifically on vehicle trajectory data. Drawing from the author\'s experience developing the TransBigData library, it provides systematic guidance on trajectory data preprocessing, analysis, mining, and visualization.',
      url: 'http://www.tup.tsinghua.edu.cn/bookscenter/book_10231801.html',
      image: 'images/book2.jpg'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <section className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-12">
        <img
          src="images/avatar.jpg"
          alt="Yu Qing"
          className="w-32 h-32 rounded-full object-cover flex-shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            {i18n.language === 'zh' ? '余庆' : 'Yu Qing'}
          </h1>
          <p className="text-gray-600 mb-1">{t('助理教授')}</p>
          <p className="text-sm text-gray-500">{t('深圳大学')}</p>
          <p className="text-sm text-gray-500 mb-3">{t('建筑与城市规划学院')}</p>
          <div className="flex items-center gap-3 text-gray-500">
            <a href="mailto:yuq@pku.edu.cn" className="hover:text-black" title="Email">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
            </a>
            <a href="https://github.com/ni1o1/" target="_blank" rel="noopener noreferrer" className="hover:text-black" title="GitHub">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a href="https://www.researchgate.net/profile/Qing_Yu51" target="_blank" rel="noopener noreferrer" className="hover:text-black" title="ResearchGate">
              <span className="iconfont icon-researchgate text-lg" />
            </a>
            <a href="https://scholar.google.com/citations?user=7m0xcqEAAAAJ&hl=zh-CN" target="_blank" rel="noopener noreferrer" className="hover:text-black" title="Google Scholar">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>
            </a>
            <a href="https://space.bilibili.com/3051484" target="_blank" rel="noopener noreferrer" className="hover:text-black" title="Bilibili">
              <span className="iconfont icon-bilibili text-lg" />
            </a>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="mb-12">
        {intro ? (
          <div className="prose prose-slate max-w-none prose-sm">
            <ReactMarkdown>{intro}</ReactMarkdown>
          </div>
        ) : (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        )}
      </section>

      {/* Latest News */}
      {news.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">{t('新闻')}</h2>
          <div className="space-y-3">
            {news.map((item) => (
              <Link
                key={item.filename}
                to={`/news/${item.filename}`}
                className="block group no-underline"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-xs text-gray-400 font-mono whitespace-nowrap">{item.date}</span>
                  <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                    {i18n.language === 'zh' ? item.title_zh : item.title_en}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Link to="/news" className="inline-block mt-4 text-sm text-gray-500 hover:text-black no-underline">
            {i18n.language === 'zh' ? '查看全部 →' : 'View all →'}
          </Link>
        </section>
      )}

      {/* Books */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('教材')}</h2>
        <div className="space-y-8">
          {books.map((book, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-6">
              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 group"
              >
                <div className="w-32 sm:w-36 overflow-hidden">
                  <img
                    src={`/${book.image}`}
                    alt={i18n.language === 'zh' ? book.title_zh : book.title_en}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </a>
              <div className="flex-1">
                <a
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <h3 className="text-base font-medium text-slate-800 hover:text-blue-600 transition-colors mb-2">
                    {i18n.language === 'zh' ? book.title_zh : book.title_en}
                  </h3>
                </a>
                <p className="text-xs text-gray-500 mb-3">
                  {i18n.language === 'zh' ? '清华大学出版社' : 'Tsinghua University Press'}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {i18n.language === 'zh' ? book.description_zh : book.description_en}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open Source Projects */}
      {projects.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">{t('开源')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {projects.map((item) => {
              const isPythonPackage = item.category === 'python_packages';
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block no-underline"
                >
                  <div className={`aspect-video overflow-hidden rounded-lg flex items-center justify-center ${
                    isPythonPackage ? 'bg-white' : 'bg-slate-100'
                  }`}>
                    <img
                      src={`/${item.image}`}
                      alt={i18n.language === 'zh' ? item.title_zh : item.title_en}
                      className={`group-hover:scale-105 transition-transform duration-300 ${
                        isPythonPackage
                          ? 'max-w-[80%] max-h-[60%] object-contain'
                          : 'w-full h-full object-cover'
                      }`}
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                      {i18n.language === 'zh' ? item.title_zh : item.title_en}
                    </h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {i18n.language === 'zh' ? item.description_zh : item.description_en}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
          <Link to="/projects" className="inline-block mt-4 text-sm text-gray-500 hover:text-black no-underline">
            {i18n.language === 'zh' ? '查看全部 →' : 'View all →'}
          </Link>
        </section>
      )}

      {/* Research Highlights */}
      {research.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('代表性成果')}</h2>
          <div className="space-y-8">
            {research.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-6">
                <a
                  href={item.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 group"
                >
                  <div className="w-full sm:w-64 aspect-video overflow-hidden bg-gray-100 flex items-center justify-center">
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
                  <div className="flex flex-wrap gap-1">
                    {item.keywords?.slice(0, 3).map((kw) => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {t(kw)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/research" className="inline-block mt-6 text-sm text-gray-500 hover:text-black no-underline">
            {i18n.language === 'zh' ? '查看全部 →' : 'View all →'}
          </Link>
        </section>
      )}
    </div>
  );
}
