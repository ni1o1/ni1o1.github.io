const e=`---
title: "Paper published | AEI | AdvMOB: Interactive Visual Analytic System for Billboard Advertising Exposure Analysis Based on Digital Twin Technology"
date: "2024-11-08"
tags:
  - "可视化系统"
  - "广告牌"
  - "数字孪生"
brief: "Recently published a paper in 'Advanced Engineering Informatics' titled 'AdvMOB: Interactive Visual Analytic System for Billboard Advertising Exposure Analysis Based on Digital Twin Technology'"
show: true
---

# AdvMOB: Interactive Visual Analytic System for Billboard Advertising Exposure Analysis Based on Digital Twin Technology

## Paper Information

![AdvMOB](../images/research/advmob/title.png)

- **Title**: AdvMOB: Interactive visual analytic system of billboard advertising exposure analysis based on urban digital twin technique
- **Journal**: Advanced Engineering Informatics
- **Date**: 11 September 2024
- **DOI**: [doi.org/10.1016/j.aei.2024.102829](https://doi.org/10.1016/j.aei.2024.102829)

## Abstract
Digital outdoor billboards have become a powerful tool for attracting consumers. However, the industry faces challenges, particularly in accurately assessing ad exposure and understanding consumer demographics. Current ad placement models often overlook ad effectiveness and oversimplify impact, leading to a significant gap between decision-making and actual results. To address these issues, this study proposes an innovative interactive visual analytic system, AdvMOB, designed to evaluate and analyze billboard exposure in urban environments and accurately depict the real reach of each ad. The system combines personal data and trajectory information to represent the true impact of individual billboards. By integrating urban building data and human mobility data, the system provides a comprehensive assessment, comparison, and in-depth analysis of billboard exposure in cities through an intuitive interface. The proposed AdvMOB system demonstrates great potential for transformative insights and comprehensive support in billboard design.

**Keywords**: Billboard exposure analysis, Digital twin, Visual analytics, Interactive system, Human mobility data

## System Architecture and Overview

The AdvMOB system is an interactive visual analytic platform for billboard exposure analysis based on urban digital twin technology. The system architecture adopts a frontend-backend separation design, with React.js for the frontend interface, DECK.GL for geospatial data visualization, and MySQL with PHP for backend data processing. The architecture comprises three main modules:

1. **Database and Data Preprocessing Module**

   This module is responsible for preparing and preprocessing various data types used in the system, including building data, billboard location data, human mobility data (e.g., mobile GPS trajectories), and socio-demographic data. The data preprocessing involves trajectory cleaning, interpolation, indexing, and road network matching. Processed data is stored in a MySQL database for later use.

2. **Analysis and Algorithm Module**

   This module includes several submodules that allow users to select visual parameters, assess exposure areas, optimize billboard placement and layout, and evaluate billboard effectiveness. The optimization algorithm, based on human mobility data, building occlusion, and billboard visibility, provides the best billboard placement and layout recommendations for users.

3. **Visualization and Interaction Module**

   Through a 3D map scene, this module displays buildings, billboards, and exposure areas within the city. Users can interact with the scene from a third-person or first-person perspective, allowing for real-time adjustments of billboard layout and location. These three modules work together to enable the AdvMOB system to help ad designers and marketing decision-makers optimize ad placement and layout with an intuitive visualization interface, enhancing ad accuracy and effectiveness.

![AdvMOB](../images/research/advmob/fig1.webp)

## Analysis in Graphics

### Billboard Exposure Analysis Model

The billboard exposure analysis model combines geometric calculations, visual parameter settings, human mobility data, and 3D visualization to provide a comprehensive analysis framework, accurately evaluating billboard exposure in urban environments.

**Visual Parameter Settings**

This model first sets the billboard’s visual parameters, which are used to estimate the visible exposure range of the billboard. The model is based on two key visual parameters:

- **Resolution**: This defines the smallest object size that can be distinguished by the viewer on the billboard. The smaller the resolution, the more compact the ad content, making it harder for viewers to distinguish.
- **Visual Acuity**: This describes the spatial resolving power of the human eye, defined as the minimum angle of resolution (MAR). It is used to calculate the minimum viewing distance at which viewers can correctly recognize ad content.

**Billboard Visible Area Calculation**

The visible area of a billboard is affected by building occlusion. The model first calculates the theoretical ground exposure area, assuming the viewer’s gaze is directed at the billboard center. It then calculates the visible area as a spherical approximation based on viewer location and angle, reflecting the field of view in 3D space. The model also calculates the occlusion effect of buildings by segmenting them into multiple surfaces and determining each surface’s shadow on the billboard using geometric relationships. Subtracting the occluded area from the ground exposure area yields the actual visible area of the billboard, indicating where viewers can see the ad content.

### Billboard Placement Model

The billboard placement model provides a powerful optimization tool by combining billboard visibility, human mobility data, and cost-benefit relationships to help advertisers precisely choose the best locations in complex urban environments for maximum ad impact.

**Trajectory Data and Visibility for Optimized Billboard Placement**

The placement model integrates human mobility data (such as mobile GPS trajectory data) to determine the potential audience size at each billboard location. For different billboard locations, the model calculates the number of people passing through the billboard's visible area, assigning different weights to each location. Higher weights indicate that a billboard at that location can reach more viewers with better exposure. The objective is to maximize return on investment (ROI) by selecting the best billboard locations. Cost is calculated based on billboard area, and the model aims to maximize ROI per unit area, ensuring efficient use of billboard space.

**Billboard Layout Optimization Model**

The billboard layout optimization model maximizes ad exposure by logically arranging ad elements on the billboard. The model divides the billboard into multiple grids, assigning weights to each grid based on exposure value, and places key ad elements (e.g., brand logos, slogans) in high-weight areas with greater visibility. The goal is to ensure that core ad content reaches the most viewers while adhering to boundary constraints and no-overlap requirements. The optimization algorithm continually adjusts element positions to achieve optimal layout in limited space, enhancing the billboard's overall effectiveness.

## Conclusion

This study developed AdvMOB, an advanced interactive visual analytic system based on urban digital twin technology for assessing and analyzing billboard exposure in urban environments. The study’s contributions include the development of a new model that combines building structures and human visual range to precisely measure billboard effectiveness, the introduction of an optimization model that integrates human mobility data, billboard size, and location importance for layout optimization, and a visual interface supporting real-time analysis and decision-making. AdvMOB addresses the complexities of urban environments and dynamic human flows that traditional methods struggle to handle, improving the precision and intelligence of ad strategies.`;export{e as default};
