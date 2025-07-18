const n=`---
title: "论文发表 | ADAPEN | 通过物联网人工智能（AIoT）、地理信息系统（GIS）和气象学的协同作用，推进建筑立面太阳能潜力评估"
date: "2025-02-09"
tags:
  - "光伏潜力"
  - "城市环境"
  - "地理信息系统"
brief: "通过结合物联网人工智能（AIoT）、地理信息系统（GIS）和气象数据，提出了一种创新方法，精确评估建筑立面光伏潜力，考虑了三维遮挡效应和城市环境因素。"
show: true
---

# 论文发表 | 通过物联网人工智能（AIoT）、地理信息系统（GIS）和气象学的协同作用，推进建筑立面太阳能潜力评估
## 论文信息

![EV](../posts/images/paper.jpg)

- 标题：Advancing building facade solar potential assessment through AIoT, GIS, and meteorology synergy
- 期刊：Advances in Applied Energy
- 时间：March 2025
- DOI： doi.org/10.1016/j.adapen.2025.100212

## 摘要

建筑太阳能潜力评估在建筑集成光伏（BIPV）和城市能源系统中发挥着至关重要的作用。虽然目前的评估主要集中在屋顶太阳能资源上，但对建筑立面 BIPV 潜力的全面分析往往缺乏。本研究提出了一种创新的方法，利用最先进的物联网人工智能（AIoT）技术、地理信息系统（GIS）和气象学，开发了一种模型，旨在准确估算考虑三维（3D）遮挡效应的空间-时间建筑立面 BIPV 潜力。我们引入了一种零样本深度学习框架，利用大型分割模型（SAM）、Grounding DINO（改进去噪锚框的检测变换器）和稳定扩散等前沿技术，进行立面元素的详细解析。通过考虑城市形态、三维遮挡影响和多源天气数据，我们能够细致地估算每个立面元素的太阳能潜力。实验结果来自四个国家的不同建筑和日本一条街道，突显了我们方法在进行立面太阳能潜力综合分析中的有效性和适用性。这些结果强调了整合阴影效应和详细立面元素对于确保准确估算光伏潜力的关键重要性。

![EV](../posts/images/fig1.png)


## 研究背景
全球向可再生能源转型的需求迫切，太阳能备受关注。在城市中，分布式 BIPV 系统因空间限制等优势凸显。不过，当前建筑太阳能潜力评估方法存在局限，对建筑立面 BIPV 潜力评估不足，且评估面临诸多挑战，如复杂的城市环境交互、材料多样性和数据获取困难等。

## 研究方法
整合建筑足迹数据和立面 RGB 图像，运用深度学习模型解析立面，将其分为窗户和墙壁；利用地理定位技术集成多源数据，包括从谷歌街景获取的 RGB 图像、Mapbox 的 3D 建筑足迹数据和国家太阳能辐射数据库（NSRDB）的气象数据。采用创新的深度学习框架，融合 SAM、Grounding DINO 和 Stable Diffusion 模型，实现建筑立面元素的精准解析与遮挡处理。运用 pybdshadow 包模拟阴影遮挡，结合建筑和气象数据，考虑温度对 BIPV 效率的影响，估算立面 BIPV 输出。

![EV](../posts/images/fig2.png)

![EV](../posts/images/fig3.png)

## 研究结果
该方法在不同建筑场景下均能准确解析立面元素，即使存在遮挡也表现出色。考虑阴影和窗户因素对 BIPV 潜力评估至关重要，忽视这些因素会导致评估不准确。不同地区建筑的 BIPV 潜力在日、月、季节变化上存在显著差异，受地理位置和气候条件影响。如瑞典季节性变化明显，澳大利亚则相对较小。

`;export{n as default};
