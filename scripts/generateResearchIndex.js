import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析markdown文件的元数据
function parseMarkdownMetadata(content) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return null;
  }
  
  const frontMatter = match[1];
  const metadata = {};
  
  // 解析YAML格式的前置数据
  const lines = frontMatter.split('\n');
  let currentKey = null;
  let isArray = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    if (trimmedLine.startsWith('- ')) {
      // 数组项
      if (currentKey && isArray) {
        const value = trimmedLine.substring(2).replace(/"/g, '');
        if (!metadata[currentKey]) {
          metadata[currentKey] = [];
        }
        metadata[currentKey].push(value);
      }
    } else if (trimmedLine.includes(':')) {
      // 键值对
      const colonIndex = trimmedLine.indexOf(':');
      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();
      
      currentKey = key;
      
      if (value === '') {
        // 可能是数组的开始
        isArray = true;
        metadata[key] = [];
      } else {
        // 普通键值对
        isArray = false;
        // 移除引号
        metadata[key] = value.replace(/^"|"$/g, '');
        
        // 转换布尔值
        if (metadata[key] === 'true') metadata[key] = true;
        if (metadata[key] === 'false') metadata[key] = false;
      }
    }
  }
  
  return metadata;
}

// 主函数
function generateResearchIndex() {
  const researchDir = path.join(__dirname, '../public/research');
  const outputPath = path.join(__dirname, '../public/research/index.json');
  
  // 确保research目录存在
  if (!fs.existsSync(researchDir)) {
    console.log('Research directory does not exist, creating...');
    fs.mkdirSync(researchDir, { recursive: true });
    return;
  }
  
  const researchData = [];
  
  // 读取所有markdown文件
  const files = fs.readdirSync(researchDir)
    .filter(file => file.endsWith('.md'))
    .sort();
  
  console.log(`Found ${files.length} research files`);
  
  for (const file of files) {
    const filePath = path.join(researchDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = parseMarkdownMetadata(content);
    
    if (metadata) {
      // 从文件名提取ID（去掉.md扩展名）
      const filename = path.basename(file, '.md');
      
      const researchItem = {
        filename,
        title_zh: metadata.title_zh || '',
        title_en: metadata.title_en || '',
        description: metadata.description || '',
        description_en: metadata.description_en || '',
        imgpath: metadata.imgpath || '',
        src: metadata.src || '',
        keywords: metadata.keywords || [],
        id: metadata.id || filename,
        show: metadata.show !== false // 默认显示
      };
      
      // 只添加要显示的且有标题的研究
      if (researchItem.show && (researchItem.title_zh || researchItem.title_en)) {
        researchData.push(researchItem);
        console.log(`Processed: ${researchItem.title_zh || researchItem.title_en}`);
      }
    } else {
      console.warn(`Failed to parse metadata for ${file}`);
    }
  }
  
  // 按ID降序排序（假设ID包含时间信息）
  researchData.sort((a, b) => b.id.localeCompare(a.id));
  
  // 写入索引文件
  fs.writeFileSync(outputPath, JSON.stringify(researchData, null, 2), 'utf-8');
  
  console.log(`\nGenerated research index with ${researchData.length} items`);
  console.log(`Output: ${outputPath}`);
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  generateResearchIndex();
}

export { generateResearchIndex };