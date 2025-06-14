---
title: "个人主页搭建完成"
date: "2024-11-07"
tags:
  - "个人主页"
  - "React"
  - "Github Pages"
brief: "React纯手搭"
show: false
---

# 个人主页搭建完成

## 个人主页在Github上搭建完成

这个网站是我搭建的个人主页，主要用于展示我的项目。我会在这里分享我的学习经历和项目经验。欢迎大家来访问我的个人主页。

### 个人主页的技术栈

这个网站是用React搭建的，采用了Github Pages进行部署，源码可以在[这里](https://github.com/ni1o1/ni1o1.github.io)找到。其中，在src/pages文件夹下存放了所有的页面内容，src/components文件夹下存放了所有的组件。

对于News页面，我采用了Markdown文件来存储新闻内容，这样可以方便我更新新闻内容。每个Markdown文件的格式如下：

```markdown
---
title: "My First Post"
date: "2024-11-07"

---

This is the content of my first blog post.
```
 
然后，通过读取Markdown文件的内容，将其渲染到页面上。这样，我就可以通过修改Markdown文件来更新新闻内容，而不需要修改代码。


