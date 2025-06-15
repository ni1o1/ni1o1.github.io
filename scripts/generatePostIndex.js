import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateIndex = () => {
  const projectRoot = path.resolve(__dirname, '..');
  const postsDir = path.join(projectRoot, 'public', 'posts-data');
  const zhDir = path.join(postsDir, 'zh');
  const enDir = path.join(postsDir, 'en');
  
  const posts = new Map();
  
  console.log('Generating posts index...');
  
  // 处理中文文件
  if (fs.existsSync(zhDir)) {
    const zhFiles = fs.readdirSync(zhDir).filter(file => file.endsWith('.md'));
    console.log(`Found ${zhFiles.length} Chinese posts`);
    
    zhFiles.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(zhDir, file), 'utf8');
        const { data } = matter(content);
        const filename = file.replace('.md', '');
        
        posts.set(filename, {
          filename,
          title_zh: data.title || '',
          title_en: '',
          brief_zh: data.brief || '',
          brief_en: '',
          date: data.date || '',
          tags: data.tags || [],
          show: data.show !== false // 默认显示，除非明确设置为false
        });
      } catch (error) {
        console.error(`Error processing Chinese file ${file}:`, error.message);
      }
    });
  }
  
  // 处理英文文件
  if (fs.existsSync(enDir)) {
    const enFiles = fs.readdirSync(enDir).filter(file => file.endsWith('.md'));
    console.log(`Found ${enFiles.length} English posts`);
    
    enFiles.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(enDir, file), 'utf8');
        const { data } = matter(content);
        const filename = file.replace('.md', '');
        
        const existing = posts.get(filename) || {
          filename,
          title_zh: '',
          title_en: '',
          brief_zh: '',
          brief_en: '',
          date: '',
          tags: [],
          show: true
        };
        
        existing.title_en = data.title || '';
        existing.brief_en = data.brief || '';
        if (!existing.date) existing.date = data.date || '';
        if (!existing.tags.length) existing.tags = data.tags || [];
        if (data.show !== undefined) existing.show = data.show;
        
        posts.set(filename, existing);
      } catch (error) {
        console.error(`Error processing English file ${file}:`, error.message);
      }
    });
  }
  
  // 过滤并排序
  const postsArray = Array.from(posts.values())
    .filter(post => post.show && (post.title_zh || post.title_en)) // 至少有一个语言的标题
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // 降序排列
    });
  
  console.log(`Generated index with ${postsArray.length} visible posts`);
  
  // 写入索引文件
  const indexPath = path.join(postsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(postsArray, null, 2));
  
  console.log(`Posts index saved to: ${indexPath}`);
  
  // 输出统计信息
  console.log('\nPosts summary:');
  postsArray.forEach(post => {
    console.log(`- ${post.filename}: ${post.title_zh || post.title_en} (${post.date})`);
  });
};

generateIndex();