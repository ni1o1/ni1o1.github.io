# 如何添加新闻

本网站的新闻系统基于 Markdown 文件，支持中英双语。

## 文件结构

```
public/posts/
├── zh/          # 中文新闻
│   └── xxx.md
├── en/          # 英文新闻
│   └── xxx.md
├── images/      # 新闻图片
│   └── xxx.png
└── index.json   # 自动生成的索引（无需手动编辑）
```

## 添加新闻步骤

### 1. 创建 Markdown 文件

在 `public/posts/zh/` 和 `public/posts/en/` 目录下创建同名的 `.md` 文件。

例如：添加一篇关于新论文发表的新闻
- 中文版：`public/posts/zh/my_new_paper.md`
- 英文版：`public/posts/en/my_new_paper.md`

### 2. 编写文件内容

每个 Markdown 文件需要包含 YAML 头部（frontmatter）：

```markdown
---
title: "论文发表 | Nature Communications | 你的论文标题"
date: "2026-01-29"
tags:
  - "标签1"
  - "标签2"
brief: "简短描述，将显示在新闻列表中"
show: true
---

# 正文标题

正文内容...

## 子标题

更多内容...

![图片描述](../posts/images/your-image.png)
```

### 3. 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 新闻标题 |
| `date` | 是 | 发布日期，格式为 `YYYY-MM-DD` |
| `tags` | 否 | 标签数组，用于分类 |
| `brief` | 否 | 简短描述 |
| `show` | 否 | 是否显示，默认为 `true`，设为 `false` 可隐藏 |

### 4. 添加图片

将图片放入 `public/posts/images/` 目录，在 Markdown 中引用：

```markdown
![图片描述](../posts/images/your-image.png)
```

### 5. 构建并预览

```bash
# 开发预览
npm run dev

# 生产构建
npm run build
```

构建时会自动运行 `generate-posts` 脚本，扫描所有新闻文件并生成 `index.json`。

## 注意事项

1. **文件名一致**：中英文版本的文件名必须相同，系统会自动匹配
2. **日期排序**：新闻按日期降序排列，最新的显示在最前面
3. **只需一种语言**：如果只有中文或英文版本，另一语言会显示为空
4. **隐藏新闻**：设置 `show: false` 可以隐藏某条新闻而不删除文件

## 示例

### 中文版 (`public/posts/zh/example.md`)

```markdown
---
title: "论文发表 | Applied Energy | 电动汽车充电行为研究"
date: "2026-01-15"
tags:
  - "电动汽车"
  - "充电站"
brief: "本研究分析了城市电动汽车的充电行为模式"
show: true
---

# 论文发表

我们的最新研究已在 Applied Energy 发表...

![研究框架](../posts/images/ev-charging.png)

## 主要发现

1. 发现一
2. 发现二
```

### 英文版 (`public/posts/en/example.md`)

```markdown
---
title: "Paper Published | Applied Energy | EV Charging Behavior Study"
date: "2026-01-15"
tags:
  - "Electric Vehicle"
  - "Charging Station"
brief: "This study analyzes urban EV charging behavior patterns"
show: true
---

# Paper Published

Our latest research has been published in Applied Energy...

![Research Framework](../posts/images/ev-charging.png)

## Key Findings

1. Finding one
2. Finding two
```
