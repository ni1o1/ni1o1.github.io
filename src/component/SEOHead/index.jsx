import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SEOHead = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const getPageInfo = (pathname) => {
    const path = pathname.replace('/', '') || 'intro';
    
    const pageInfo = {
      intro: {
        title: i18n.language === 'en' 
          ? 'Qing Yu - Transportation Big Data & Smart City Research'
          : '余庆 - 交通大数据与智慧城市研究',
        description: i18n.language === 'en'
          ? 'Dr. Qing Yu, Postdoctoral Researcher at Peking University Shenzhen Graduate School, specializing in transportation big data, smart cities, electric vehicles, and shared mobility research.'
          : '余庆博士，北京大学深圳研究生院博士后，专注于交通大数据分析、智慧城市、电动汽车、共享交通等领域的研究。',
        keywords: i18n.language === 'en'
          ? 'Qing Yu, Transportation Big Data, Smart City, Electric Vehicle, Shared Mobility, Urban Planning, Data Analysis'
          : '余庆,交通大数据,智慧城市,电动汽车,共享交通,城市规划,数据分析'
      },
      research: {
        title: i18n.language === 'en'
          ? 'Research - Qing Yu | Transportation & Urban Studies'
          : '研究成果 - 余庆 | 交通与城市研究',
        description: i18n.language === 'en'
          ? 'Latest research publications and findings in transportation big data, electric vehicle modeling, shared mobility systems, and urban planning.'
          : '最新的交通大数据、电动汽车建模、共享出行系统和城市规划研究成果与发现。',
        keywords: i18n.language === 'en'
          ? 'Research Publications, Transportation Research, Electric Vehicle, V2G, Shared Mobility, Urban Transit'
          : '研究论文,交通研究,电动汽车,V2G,共享出行,城市交通'
      },
      publication: {
        title: i18n.language === 'en'
          ? 'Publications - Qing Yu | Academic Papers & Books'
          : '论著 - 余庆 | 学术论文与著作',
        description: i18n.language === 'en'
          ? 'Complete list of academic publications, journal papers, conference proceedings, and books by Dr. Qing Yu.'
          : '余庆博士的完整学术发表列表，包括期刊论文、会议论文和专著。',
        keywords: i18n.language === 'en'
          ? 'Academic Publications, Journal Papers, Conference Papers, Transportation Books, Research Output'
          : '学术发表,期刊论文,会议论文,交通著作,研究成果'
      },
      projects: {
        title: i18n.language === 'en'
          ? 'Open Source Projects - Qing Yu | Transportation Data Tools'
          : '开源项目 - 余庆 | 交通数据工具',
        description: i18n.language === 'en'
          ? 'Open source software and tools for transportation data analysis, including TransBigData Python package and visualization tools.'
          : '交通数据分析的开源软件和工具，包括TransBigData Python包和可视化工具。',
        keywords: i18n.language === 'en'
          ? 'Open Source, Python, TransBigData, Transportation Tools, Data Visualization, GitHub'
          : '开源项目,Python,TransBigData,交通工具,数据可视化,GitHub'
      },
      news: {
        title: i18n.language === 'en'
          ? 'News & Updates - Qing Yu | Latest Activities'
          : '新闻动态 - 余庆 | 最新活动',
        description: i18n.language === 'en'
          ? 'Latest news, updates, and activities from Dr. Qing Yu\'s research and academic work.'
          : '余庆博士研究和学术工作的最新新闻、更新和活动。',
        keywords: i18n.language === 'en'
          ? 'News, Updates, Academic Activities, Research News, Conference Presentations'
          : '新闻,更新,学术活动,研究动态,会议报告'
      },
      group: {
        title: i18n.language === 'en'
          ? 'Research Group - Qing Yu | Team & Collaboration'
          : '研究团队 - 余庆 | 团队与合作',
        description: i18n.language === 'en'
          ? 'Information about Dr. Qing Yu\'s research group, team members, and collaborative projects.'
          : '余庆博士研究团队、团队成员和合作项目的信息。',
        keywords: i18n.language === 'en'
          ? 'Research Group, Team Members, Collaboration, Academic Team, Research Lab'
          : '研究团队,团队成员,合作,学术团队,研究实验室'
      }
    };

    // Handle news detail pages
    if (path.startsWith('news/')) {
      return {
        title: i18n.language === 'en'
          ? 'News Detail - Qing Yu'
          : '新闻详情 - 余庆',
        description: pageInfo.news.description,
        keywords: pageInfo.news.keywords
      };
    }

    return pageInfo[path] || pageInfo.intro;
  };

  useEffect(() => {
    const pageInfo = getPageInfo(location.pathname);
    
    // Update document title
    document.title = pageInfo.title;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', pageInfo.description);
    }
    
    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', pageInfo.keywords);
    }
    
    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', pageInfo.title);
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', pageInfo.description);
    }
    
    // Update Twitter Card tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', pageInfo.title);
    }
    
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) {
      twitterDescription.setAttribute('content', pageInfo.description);
    }
    
    // Update canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const baseUrl = 'https://ni1o1.github.io';
      const currentPath = location.pathname === '/' ? '' : location.pathname;
      canonical.setAttribute('href', `${baseUrl}${currentPath}`);
    }
    
  }, [location.pathname, i18n.language]);

  return null; // This component doesn't render anything
};

export default SEOHead;