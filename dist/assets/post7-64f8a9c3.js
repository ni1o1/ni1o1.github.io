const e=`---
title: "Paper published | ADAPEN | Advancing building facade solar potential assessment through AIoT, GIS, and meteorology synergy"
date: "2025-02-09"
tags:
  - "光伏潜力"
  - "城市环境"
  - "地理信息系统"
brief: "By integrating Artificial Intelligence of Things (AIoT), Geographic Information Systems (GIS), and meteorological data, an innovative method is proposed to accurately assess building facade photovoltaic potential, considering 3D shading effects and urban environmental factors."
show: true
---

# Paper published | Advancing building facade solar potential assessment through AIoT, GIS, and meteorology synergy

## Paper Information

![EV](../posts/images/paper.jpg)

- **Title**: Advancing building facade solar potential assessment through AIoT, GIS, and meteorology synergy
- **Journal**: Advances in Applied Energy
- **Publication Date**: March 2025
- **DOI**: doi.org/10.1016/j.adapen.2025.100212

## Abstract
The assessment of building solar potential plays a pivotal role in Building Integrated Photovoltaics (BIPV) and urban energy systems. While current evaluations predominantly focus on rooftop solar resources, a comprehensive analysis of building facade BIPV potential is often lacking. This study presents an innovative methodology that harnesses state-of-the-art Artificial Intelligence of Things (AIoT) techniques, Geographic Information Systems (GIS), and Meteorology to develop a model for accurately estimating spatial–temporal building facade BIPV potential considering 3 Dimension (3D) shading effect. Here, we introduce a zero-shot Deep Learning framework for detailed parsing of facade elements, utilizing cutting-edge techniques in Large-scale Segment Anything Model (SAM), Grounding DINO (Detection Transformer with improved denoising anchor boxes), and Stable Diffusion. Considering urban morphology, 3D shading impacts, and multi-source weather data enables a meticulous estimation of solar potential for each facade element. The experimental findings, gathered from a range of buildings across four countries and an entire street in Japan, highlight the effectiveness and applicability of our approach in conducting comprehensive analyses of facade solar potential. These results underscore the critical importance of integrating shadow effects and detailed facade elements to ensure accurate estimations of PV potential.


![EV](../posts/images/fig1.png)


## Research Background

The global demand for a transition to renewable energy is urgent, and solar energy has received significant attention. In urban areas, distributed BIPV (Building-Integrated Photovoltaics) systems stand out due to advantages such as spatial constraints. However, current methods for assessing the potential of building-integrated solar energy are limited, especially in evaluating the potential of BIPV on building facades. Furthermore, these assessments face numerous challenges, including complex urban environmental interactions, material diversity, and difficulties in data collection.

## Research Method

This study integrates building footprint data and RGB facade images, using deep learning models to analyze the facade and classify it into windows and walls. Geographic location technology is applied to integrate multi-source data, including RGB images from Google Street View, 3D building footprint data from Mapbox, and meteorological data from the National Solar Radiation Database (NSRDB). An innovative deep learning framework, combining SAM, Grounding DINO, and Stable Diffusion models, is used to achieve precise analysis of facade elements and handle occlusions. The pybdshadow package is utilized to simulate shadow occlusions, and with building and meteorological data, the temperature’s impact on BIPV efficiency is considered to estimate facade BIPV output.

![EV](../posts/images/fig2.png)

![EV](../posts/images/fig3.png)

## Research Results

This method accurately analyzes facade elements in various building scenarios, even in the presence of occlusions. Considering factors like shadow and windows is crucial for accurate BIPV potential assessment, ignoring these factors can lead to inaccurate evaluations. BIPV potential for buildings varies significantly by day, month, and season, influenced by geographical location and climate conditions. For example, Sweden shows noticeable seasonal variation, while Australia experiences relatively smaller variations.`;export{e as default};
