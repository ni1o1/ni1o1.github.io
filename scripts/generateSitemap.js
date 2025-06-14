import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateSitemap = () => {
  const baseUrl = 'https://ni1o1.github.io';
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Define static pages with their priorities and change frequencies
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/intro', priority: '0.9', changefreq: 'monthly' },
    { url: '/research', priority: '0.9', changefreq: 'weekly' },
    { url: '/publication', priority: '0.8', changefreq: 'monthly' },
    { url: '/projects', priority: '0.8', changefreq: 'monthly' },
    { url: '/news', priority: '0.7', changefreq: 'weekly' },
    { url: '/group', priority: '0.6', changefreq: 'monthly' }
  ];
  
  // Get dynamic news pages
  const newsPages = [];
  const newsDir = path.join(__dirname, '../public/news');
  
  try {
    if (fs.existsSync(newsDir)) {
      const newsFiles = fs.readdirSync(newsDir)
        .filter(file => file.endsWith('.md'))
        .map(file => {
          const slug = file.replace('.md', '');
          const filePath = path.join(newsDir, file);
          const stats = fs.statSync(filePath);
          return {
            url: `/news/${slug}`,
            priority: '0.6',
            changefreq: 'monthly',
            lastmod: stats.mtime.toISOString().split('T')[0]
          };
        });
      newsPages.push(...newsFiles);
    }
  } catch (error) {
    console.log('No news directory found, skipping news pages in sitemap');
  }
  
  // Get dynamic research pages
  const researchPages = [];
  const researchDir = path.join(__dirname, '../public/research');
  
  try {
    if (fs.existsSync(researchDir)) {
      const researchFiles = fs.readdirSync(researchDir)
        .filter(file => file.endsWith('.md'))
        .map(file => {
          const slug = file.replace('.md', '');
          const filePath = path.join(researchDir, file);
          const stats = fs.statSync(filePath);
          return {
            url: `/research/${slug}`,
            priority: '0.7',
            changefreq: 'monthly',
            lastmod: stats.mtime.toISOString().split('T')[0]
          };
        });
      researchPages.push(...researchFiles);
    }
  } catch (error) {
    console.log('No research directory found, skipping research detail pages in sitemap');
  }
  
  // Combine all pages
  const allPages = [
    ...staticPages.map(page => ({ ...page, lastmod: currentDate })),
    ...newsPages,
    ...researchPages
  ];
  
  // Generate XML
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const urlsetClose = '</urlset>\n';
  
  const urls = allPages.map(page => {
    return `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }).join('\n');
  
  const sitemap = xmlHeader + urlsetOpen + urls + '\n' + urlsetClose;
  
  // Write sitemap to public directory
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  
  console.log(`✅ Sitemap generated successfully with ${allPages.length} pages`);
  console.log(`📍 Sitemap saved to: ${sitemapPath}`);
};

// Run the generator
generateSitemap();