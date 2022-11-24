import React from 'react'
import { Typography, Divider } from 'antd';
import ReactMarkdown from 'react-markdown'


const { Title, Paragraph, Text, Link } = Typography;

export default function Publication() {
  const markdown = `
  ## 著作/章节

  1. [余庆，李玮锋. 交通时空大数据分析、挖掘与可视化. 清华大学出版社](http://product.dangdang.com/12000002206.html)
  2. [Yu, Q.; Li, W.; Yang,D. Chapter 6: Data-driven Estimation for Urban Travel Shareability. Big Data and Mobility as a Service. Elsevier, 2022](https://www.elsevier.com/books/big-data-and-mobility-as-a-service/zhang/978-0-323-90169-7)
  
  ## 学术论文
  
  论文可在这里下载:[百度网盘链接](https://pan.baidu.com/s/1gx9fDyYdJPcmL5WwZOZDnA?pwd=efak) 提取码: efak 

  ### 2022
  1. [Sun S, Zheng Y, Dong Y, Li N, Jin Z, **Yu Q**. Reducing external container trucks’ turnaround time in ports: A data-driven approach under truck appointment systems. Computers & Industrial Engineering](https://doi.org/10.1016/j.cie.2022.108787)
  1. [Duan Z, Liu X, **Yu Q**, Li Y. Analyzing Detour Behavior of Metro Passengers Based on Mobile Phone Data. Transportation Planning and Technology](https://www.tandfonline.com/doi/abs/10.1080/03081060.2022.2103559).
  1. [**Yu, Q.**, Xie, Y., Li, W., Zhang, H., Liu X. , Shang W. , Chen J. , Yang D. , Yan J. (2022). GPS data in urban bicycle-sharing: Dynamic electric fence planning with assessment of resource-saving and potential energy consumption increasement. Applied Energy,2022,322,119533.](https://doi.org/10.1016/j.apenergy.2022.119533)
  1. [Wu, Y., Li, W., **Yu, Q.**, & Li, J. (2022). Analysis of the Relationship between Dockless Bicycle-Sharing and the Metro: Connection, Competition, and Complementation. Journal of Advanced Transportation, 2022.](https://doi.org/10.1155/2022/5664004)
  1. [Hui Y, Xie Y, **Yu Q**, Liu X, Wang X. Hotspots Identification and Classification of Dockless Bicycle Sharing Service Under Electric Fence Circumstances. Journal of Advanced Transportation, 2022.](https://www.hindawi.com/journals/jat/2022/5218254/)(Corresponging Author)
  1. [**Yu, Q.**, Li, W., Zhang, H., & Chen, J. (2022). GPS data in taxi-sharing system: Analysis of potential demand and assessment of fuel consumption based on routing probability model. Applied Energy, 314, 118923.](https://www.sciencedirect.com/science/article/pii/S0306261922003452)
  1. [**Yu Q**, Yuan J. TransBigData: A Python package for transportation spatio-temporal big data processing, analysis and visualization[J]. Journal of Open Source Software, 2022, 7(71): 4021.](https://joss.theoj.org/papers/10.21105/joss.04021.pdf)
  1. [Jinyu Chen, Qiong Zhang, Ning Xu, Wenjing Li, Yuhao Yao, Peiran Li, **Qing Yu**, Chuang Wen, Xuan Song, Ryosuke Shibasaki, Haoran Zhang, et al. Roadmap to hydrogen society of Tokyo: Locating priority of hydrogen facilities based on multiple big data fusion[J]. Applied Energy, 2022, 313: 118688.](https://www.sciencedirect.com/science/article/pii/S0306261922001532)
  1. [**余庆**，李玮峰，杨东援.基于手机信令数据的扬子江城市群空间联系结构分析[J].交通与运输,2022.](https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CJFD&dbname=CJFDAUTO&filename=YSJT202203017&uniplatform=NZKPT&v=1QS8XwiyqtXLVDFNEtLfuHBJ4THjEX7dU6YpKLe3IWgcpaBvMId4d3OrV_sRQ0_r)
  1. [刘晓磊,段征宇,**余庆**,毛孝鑫,马忠政.基于图卷积循环神经网络的城市轨道客流预测[J].华南理工大学学报(自然科学版),2022,50(03):21-27.](https://t.cnki.net/kcms/detail?v=2Hzf_72mFvBdsFLO9b9qrZ6RFL97CApNUVoRu7CRdkjN0Uho-lPWHE6vjEjLfcsHiW2awBnCwAkSK5_JIuk1VV-Pfg89oNZU2t8MMd7Za7AEhrCwksK-sJk8KIO7ohWj&uniplatform=NZKPT)
 
  ### 2021
  
  1. Li Y, Li W, **Yu Q**. Analysis of pedestrian mid block crossing demand intensity based on point of interest data. The 25th international conference of hong kong society for transportation studies(HKSTS), 2021
  2. [Li Y, Li W, **Yu Q**, et al. Taxi Global Positioning System Data in Urban Road Network: A Methodology to Identify Key Road Clusters Based on Travel Speed–Traffic Volume Correlation[J]. Transportation Research Record, 2021: 03611981211036684.](https://journals.sagepub.com/doi/10.1177/03611981211036684)(Corresponging Author)
  3. [Bi, H., Shang, W.-L., Chen, Y., Wang, K., **Yu, Q.**, Sui, Y., 2021. GIS aided sustainable urban road management with a unifying queueing and neural network model. Applied Energy 291, 116818. ](https://doi.org/10.1016/j.apenergy.2021.116818)
  4. [**Yu, Q.**; Li, W.; Yang, D.; Zhang, H. Partitioning urban road network based on travel speed correlation. International Journal of Transportation Science and Technology, 2021](https://www.sciencedirect.com/science/article/pii/S2046043021000034)
  5. [Zhang, H., Yan, J., **Yu, Q.**, Obersteiner, M., Li, W., Chen, J., Zhang, Q., Jiang, M., Wallin, F., Song, X., Wu, J., Wang, X., Shibasaki, R., 2021. 1.6 Million transactions replicate distributed PV market slowdown by COVID-19 lockdown. Applied Energy 116341.](https://doi.org/10.1016/j.apenergy.2020.116341)
  6. [**Yu, Q.**; Li, W.; Yang, D.; Xie, Y. Policy Zoning for Efficient Land Utilization Based on Spatio-Temporal Integration between the Bicycle-Sharing Service and the Metro Transit. Sustainability 2021, 13, 141.](https://www.mdpi.com/2071-1050/13/1/141#cite)
  7. [**Yu, Q.**, Li W, Yang D. Spatio-temporal Integration between the Bicycle-sharing Service and the Metro Transit: A Case Study in Shanghai, China. Transportation Research Board 2021 Annual Meeting](https://www.researchgate.net/deref/http%3A%2F%2Fdx.doi.org%2F10.13140%2FRG.2.2.34178.50882?_sg%5B0%5D=ZbyKBV1mpkBMNI0XBCdDlAhcfZF1qRQuYWPKyo4Vt-ZGll8Y-D8CDI5k1iAd8c4uzpoKQCK9239P-BOCH_Kn9NjETg.EUQLBxrP1WhjSFneds1pMYEuTGbnm_bhBbMfFVcc2v1BqEsnsT1F9DQ7Hm4OYjFWFuEvcp1KxL3tw3gRmaF89w)
  
  ### 2020
  
  1. [**Yu, Q.**; Li, W.; Yang, D.; Zhang, H. Mobile Phone Data in Urban Commuting: A Network Community Detection-Based Framework to Unveil the Spatial Structure of Commuting Demand. Journal of Advanced Transportation, 2020.](https://doi.org/10.1155/2020/8835981)
  2. [**Yu, Q.**; Li, W.; Chen, J.; Yang, D.; Sui, Y.; Zhang, H. GPS data in urban taxi-sharing: A routing behavior based potential assessment method and spatiotemporal analysis on operation efficiency and energy consumption. enerarxiv 20.](https://www.enerarxiv.org/page/thesis.html?id=2416)
  3. [Jiang W, Zhang H, Long Y, Chen J, Sui Y, Song X, Shibasaki R, **Yu Q**, GPS data in urban online ride-hailing: The technical potential analysis of demand prediction model, Journal of Cleaner Production, 2020, 123706](http://www.sciencedirect.com/science/article/pii/S0959652620337513)
  4. [**Yu, Q.**; Li, W.; Zhang, H.; Yang, D. Mobile Phone Data in Urban Customized Bus: A Network-based Hierarchical Location Selection Method with an Application to System Layout Design in the Urban Agglomeration. Sustainability 2020, 12, 6203.](https://www.mdpi.com/2071-1050/12/15/6203)
  5. [**Yu Q**, Zhang H, Li W, et al. Mobile phone GPS data in urban customized bus: dynamic line design and emission reduction potentials analysis. Journal of Cleaner Production, 2020, p. 122471.](https://www.sciencedirect.com/science/article/pii/S095965262032518X)
  6. [何凌晖,**余庆**,李玮峰,李健,杨东援.新冠肺炎疫情影响下的城际交通运输需求分析.城市交通:1-11.https://doi.org/10.13813/j.cn11-5141/u.2020.0024.](http://kns.cnki.net/kcms/detail/11.5141.U.20200521.1714.002.html)
  7. [**Yu Q**, Zhang H, Li W, et al. Mobile phone data in urban bicycle-sharing: Market-oriented sub-area division and spatial analysis on emission reduction potentials. Journal of Cleaner Production, 2020, 254: 119974.](https://www.sciencedirect.com/science/article/pii/S0959652620300214)

  ### 2019
  
  1. [**Yu Q**, Li W, Yang D. Overlapping communities in network unveil urban commuting structure from mobile phone data. *Transportation Research Board 98th Annual MeetingTransportation Research Board*](http://amonline.trb.org/68387-trb-1.4353651/t005-1.4370696/1214-1.4371409/19-00578-1.4364053/19-00578-1.4371444)

  ### 2018
  
  1. [Wang Y, Chen C, **Yu Q**. Analysis of Chinese Typical Urban Public Transport Network Types and Influencing Factors//CICTP 2018: Intelligence, Connectivity, and Mobility. Reston, VA: American Society of Civil Engineers, 2018: 913-924.](https://ascelibrary.org/doi/abs/10.1061/9780784481523.091)
  2. [**Yu Q**, Li W, Duan Z, et al. Unveiling Urban Commuting Structure from Mobile Phone Data: A Case Study in Shanghai, China. 2018. *Transportation Research Board 97th Annual MeetingTransportation Research Board*](https://trid.trb.org/view/1494574)
  3. [李俊,**余庆**,杨东援.城市生活性物流设施网络实证研究.综合运输,2018,40(04):84-91.](http://cpfd.cnki.com.cn/Article/CPFDTOTAL-CSJT201706001103.htm)
  
  ### 2017
  
  1. [**Yu Q**, Li W F, Duan Z Y, et al. Activity Space Investigations for Nonresidents Using Mobile Phone Data. *CICTP 2017: Transportation Reform and Change—Equity, Inclusiveness, Sharing, and Innovation*](https://ascelibrary.org/doi/abs/10.1061/9780784480915.015)
  2. [**余庆**, 雷曾翔, 李玮峰, 等. 基于多源数据的公交客流规模关联分析. 综合运输, 2017, 39(6): 58-63.](http://www.cnki.com.cn/Article/CJFDTotal-YSZH201706015.htm)
  3. [李俊, 杨东援, **余庆**. 基于 POI 数据的配送企业网络布局. 2017 年中国城市交通规划年会论文集, 2017.](http://cpfd.cnki.com.cn/Article/CPFDTOTAL-CSJT201706001103.htm)
  4. [李玮峰, 程小云, **余庆**, 等. 基于多源数据的居民活动区域特征分析. 规划 60 年: 成就与挑战——2016 中国城市规划年会论文集 04 城市规划新技术应用, 2016.](http://cpfd.cnki.com.cn/Article/CPFDTOTAL-ZHCG201609004079.htm)
  
  ## 获奖
  1. 2022 上海市优秀毕业生
  1. 2022 第十三届上海市决策咨询研究成果奖 二等奖（排名第9）
  1. 2021 博士研究生国家奖学金
  1. 2021 SmallWorld AI 项目获R&D 100 Awards优胜奖、SMART 50 Awards（负责子模块可视化系统3D UrbanMOB开发）
  1. [2021数字中国创新大赛大数据赛道-城市管理大数据专题算法题 一等奖](https://www.bilibili.com/video/BV1xh411S7jT)
  1. [2021厦门大数据安全开放创新应用大赛资源规划专题创意分析题 二等奖](https://www.bilibili.com/video/BV15Q4y1U7bh)
  1. 2021年度江苏省科技咨询协会科学技术奖 二等奖 项目名称：城市群交通规划方法和应用技术研究（排名第10）
  1. 2020 同济大学京川奖学金 一等奖

  `
  
  return (
    <Typography>
    <ReactMarkdown children={markdown}  />
    </Typography>
  )
}
