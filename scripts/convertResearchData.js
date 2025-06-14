import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取研究数据
const researchDataPath = '/Library/WebServer/Documents/ni1o1.github.io/src/pages/Research/researchData.json';
const outputDir = '/Library/WebServer/Documents/ni1o1.github.io/public/research';

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取JSON数据
const researchData = JSON.parse(fs.readFileSync(researchDataPath, 'utf8'));

// 为每个研究项目创建markdown文件
researchData.forEach(item => {
  const filename = `research_${item.id.split('_')[1].padStart(3, '0')}.md`;
  const filePath = path.join(outputDir, filename);
  
  // 格式化keywords为YAML列表格式
  const keywordsYaml = item.keywords.map(keyword => `  - "${keyword}"`).join('\n');
  
  // 创建markdown内容
  const markdownContent = `---
title_zh: "${item.title_zh}"
title_en: "${item.title_en}"
description: "${item.description}"
description_en: "${item.description_en}"
imgpath: "${item.imgpath}"
src: "${item.src}"
keywords:
${keywordsYaml}
id: "${item.id}"
show: true
---

# ${item.title_zh}
## 研究背景

${item.description}

## 研究方法

本研究采用了先进的数据分析方法和技术手段，通过多维度的数据收集和处理，深入探索相关问题的本质和规律。

## 主要发现

研究取得了重要的理论和实践成果，为相关领域的发展提供了有价值的见解和指导。

## 研究意义

本研究的成果对于推动相关领域的理论发展和实际应用具有重要意义，为后续研究和实践提供了坚实的基础。

## 相关链接

- [查看详细内容](${item.src})
- 关键词：${item.keywords.join(', ')}
`;
  
  // 写入文件
  fs.writeFileSync(filePath, markdownContent, 'utf8');
  console.log(`Created: ${filename}`);
});

console.log(`\n转换完成！共创建了 ${researchData.length} 个markdown文件。`);
console.log(`输出目录: ${outputDir}`);