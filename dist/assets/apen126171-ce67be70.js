const e=`---
title: "Article Publication | APEN | Spatiotemporal Feature Encoded Deep Learning Method for Rooftop PV Potential Assessment"
date: "2025-05-23"
tags:
  - "太阳能"
  - "可再生能源"
  - "深度学习"
  - "3D建筑足迹"
  - "城市能源系统"
brief: "This study proposes a deep learning method that integrates 3D building, solar position, and meteorological data to efficiently and accurately predict rooftop shadows and assess PV potential."
show: true
---

# Paper Published | Applied Energy | Spatiotemporal Feature Encoded Deep Learning Method for Rooftop PV Potential Assessment

Original Title: Spatiotemporal Feature Encoded Deep Learning Method for Rooftop PV Potential Assessment

Original Link: [https://doi.org/10.1016/j.apenergy.2025.126171](https://doi.org/10.1016/j.apenergy.2025.126171)

## Abstract

Rooftop photovoltaic (PV) systems represent a promising solution for enhancing renewable energy utilization in urban landscapes. Accurate estimation of rooftop PV power generation potential is hindered by shading effects induced by complex urban morphology, which significantly reduce solar irradiance on rooftop surfaces and lead to prediction errors. Traditional shading simulation methods are computationally expensive, underscoring the need for a nuanced equilibrium between computational efficiency and assessment accuracy. In this study, we introduce an innovative deep learning framework that effectively encodes a diverse array of spatiotemporal data sources to accurately predict shadow casting and calculate rooftop PV potential. Specifically, utilizing physics-based ground truth, the incorporation of the U-Net network along with three-dimensional (3D) building specifics, solar resource data, and meteorological parameters enables us to make precise forecasts regarding temporal changes in rooftop shadow patterns. This not only enhances computational efficiency but also ensures a high level of precision in power generation predictions. Experimental assessments carried out in Futian District, Shenzhen, reveal that shading effects alone result in an average energy loss of 5.32\\% across rooftops. Moreover, our framework demonstrates superior performance compared to physics-based models, achieving an average Mean Absolute Percentage Error (MAPE) of 2.85\\% for annual energy generation potential and a mean Intersection over Union (mIoU) of 89.23\\% for shading effect evaluation. In addition, the proposed framework achieves approximately 158× and 65× speedup over traditional ray-casting and optimized ray-tracing methods respectively, highlighting its strong suitability for large-scale urban energy evaluations. Our contributions encompass the development of a novel deep learning framework for rooftop PV potential assessment, enhanced computational efficiency in urban analyses, and a resilient generalization capability with high accuracy across various urban settings.

## Research Gap

Accurate and efficient assessment of urban rooftop PV potential faces a critical challenge in balancing computational efficiency with accuracy, particularly due to the complex 3D urban morphology and dynamic shading effects. Traditional physics-based methods (e.g., ray-casting, 3D-GIS) are accurate for modeling dynamic shading but computationally prohibitive for large-scale urban applications, while simplified methods are fast but lack accuracy by neglecting crucial shading factors. Although deep learning has been applied to rooftop feature extraction, it has not yet been utilized for dynamic shading calculation. Therefore, there is a significant need for a novel method that can efficiently and accurately predict dynamic rooftop shading and subsequently assess PV potential at scale.

## Core Content

This study proposes a deep learning-based framework for efficient and accurate assessment of urban rooftop PV potential.

*   **Framework Overview and Data Preparation:** The study constructs an integrated framework comprising a deep learning module for shadow prediction and a PV potential calculation module. Initially, spatiotemporal information including 3D building data, solar altitude, and azimuth angles is transformed into a three-channel raster image format to serve as input for the deep learning model. Simultaneously, physics-based methods utilizing trigonometric principles are employed to generate raster images of rooftop shadow distributions at different times as ground truth labels for model training.

![title](../posts/images/WX20250523-150707.png)

*   **Deep Learning Model Design and Training:** A deep learning model based on the U-Net architecture (with an FCN decoder head) is used. The input is a multi-channel image encoding 3D building and solar position information, and the output is pixel-wise classification results for rooftop shadow, illumination, and ground areas. The model includes an encoder (convolution, ReLU, BatchNorm, MaxPooling) and a decoder (upsampling, skip connections, convolution). It is trained using a cross-entropy loss function, with class weights adjusted to handle the data imbalance issue for the shadow class.

![title](../posts/images/WX20250523-150738.png)

*   **PV Potential Calculation Model:** Using the rooftop shadow/illumination area information predicted by the deep learning model, combined with meteorological data (Direct Normal Irradiance, Diffuse Horizontal Irradiance, Global Horizontal Irradiance, temperature, wind speed) and PV system parameters (tilt angle, albedo, etc.), the pvlib library is used to calculate the total irradiance received on the Plane of Array (POA) on the rooftop and further estimate the PV generation potential per unit area.


*   **Shadow and Illumination Prediction Results and Spatiotemporal Validation:** The model predicted rooftop shadow and illumination distributions in Futian District, Shenzhen. The results show an IoU of 72.8% for shadowed areas, 95.31% for illuminated areas, and 100% for ground areas. The model's spatiotemporal predictions show high consistency with the physics-based model, although accuracy for shadow detection slightly decreases around midday when shadow areas are minimal.

![title](../posts/images/WX20250523-150837.png)

![title](../posts/images/WX20250523-150847.png)

*   **PV Potential Assessment Results and Validation:** The predicted shadow information was used for PV potential calculation and validated in Futian District. The regional-scale annual generation total prediction showed high agreement with ground truth (average MAPE 2.85%). Single-building analysis demonstrated that shading is a critical factor affecting PV potential, with heavily shaded buildings showing significantly reduced potential. Monthly potential analysis at the regional scale revealed clear seasonal variations.

![title](../posts/images/WX20250523-150954.png)

![title](../posts/images/WX20250523-150941.png)


*   **Spatial Analysis of PV Potential in Futian District:** A spatial distribution analysis of annual rooftop PV potential across Futian District was conducted. Results show potential varies between 200-350 kWh/m², significantly influenced by building density and height differences. Areas with high shading have lower potential, with average shading causing about 5.32% energy loss. Statistical distribution shows most rooftops exceed a viability threshold, but some buildings have low potential due to severe shading.

![title](../posts/images/WX20250523-151041.png)
![title](../posts/images/WX20250523-151030.png)


*   **Computational Efficiency Analysis:** The computational efficiency of the deep learning framework was compared with physics-based models (Pybdshadow and Ray Tracing). The deep learning framework required only 1.34 hours to compute the annual shadow distribution for Futian District, compared to 213.21 hours for Pybdshadow and 87.60 hours for Ray Tracing, achieving speedups of approximately 158× and 65×, respectively. The deep learning method shows a lower growth rate in computation with increasing building count and more stable computation time.
![title](../posts/images/WX20250523-151124.png)

## Conclusion

This study presents an innovative deep learning-based framework for accurate and efficient rooftop PV potential assessment in urban environments. By integrating high-accuracy rooftop shadow prediction with meteorological data, the framework successfully quantifies urban building PV potential. Validation in Shenzhen's Futian District demonstrates the method's excellent performance in shadow prediction (Shadow IoU 72.8%) and PV potential assessment (annual potential MAPE < 3%). The study quantifies the impact of urban morphology on PV potential, finding that shading causes an average 5.32% energy loss and that building height variation and density are key factors influencing potential distribution. Crucially, the framework achieves a significant breakthrough in computational efficiency, providing up to 158× speedup over traditional physics-based models, enabling efficient large-scale urban analysis.

The findings provide urban planners and policymakers with a powerful tool to support more precise solar deployment planning and policy formulation, contributing to sustainable urban energy development. Although the model's accuracy in complex shaded environments can be further improved and practical constraints like structural feasibility were not explicitly considered, future research will explore more advanced model architectures, higher-resolution data, and comprehensive practical factors to enhance the model's generalizability and applicability, enabling its direct use in diverse cities globally.

`;export{e as default};
