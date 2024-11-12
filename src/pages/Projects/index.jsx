import React from 'react'
import { Card, Row, Col, Typography, Divider } from 'antd';

import { useTranslation } from 'react-i18next';

const { Meta } = Card;
const { Title, Paragraph } = Typography;


export default function Visualization() {
  const { t,i18n } = useTranslation();

  function Visualcard(src, imgpath, title, description) {
    return <Col span={8} xs={24} sm={24} md={24} lg={12} xl={8} xxl={6}>
      <a href={src}>
        <Card
          hoverable
          bordered={true}
          size='small'
          cover={<img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'cover' }} height='150' />}
          type='inner'
        >
          <Meta title={title} description={description} style={{ 'height': '80px' }} />
        </Card>
      </a>
    </Col>
  }
  function Visualcard2(src, imgpath, title, description) {
    return <Col span={8} xs={24} sm={24} md={12} lg={12} xl={8} xxl={6}>
      <a href={src}>
        <Card
          hoverable
          bordered={true}
          size='small'
          cover={<img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'cover' }} height='150' />}
        >
          {/* <Meta title={title} description={description} /> */}
        </Card>
      </a>
    </Col>
  }
  function viscard(herf, src, title, description) {
    return <Col span={8} xs={24} sm={24} md={24} lg={12} xl={12} xxl={12}>
      <a href={herf}>
        <Card
          hoverable
          size='small'
          cover={<img alt="transbigdata" src={src} style={{ 'object-fit': 'contain' }} height='150' />}
    
        >
          <Meta title={title} description={description} style={{'height':'100px'}}/>
        </Card>
      </a>
    </Col>
  }
  return (
    <div style={{ margin: 12 }}>
      <Title level={4}>{t("Python库")}</Title>
        <Row gutter={[10, 10]}>
          {viscard("https://github.com/ni1o1/transbigdata", "images/logo-wordmark-dark-small.png", "TransBigData", "Processing, analyzing, and visualizing spatiotemporal transportation data")}
          {viscard("https://github.com/ni1o1/pybdshadow", "images/pybdshadow.png", "pybdshadow", "Estimate building shadows from building footprints")}
        </Row>
        <Divider />
      <Title level={4}>{t("开源可视化项目")}</Title>
      <Row gutter={[10, 10]}>
        {Visualcard("https://github.com/ni1o1/GeoJSONViewer",
          "images/GeoJSONviewer.png",
          "GeoJSON Viewer",
          "Visualize and edit GeoJSON files")}
        {Visualcard("https://github.com/ni1o1/SmartEV/",
          "images/SmartEV.png",
          "Smart Battery Cloud Platform",
          "")}
        {Visualcard("https://github.com/ni1o1/nikebus",
          "images/nikebus.png",
          "SUSTech Shuttle Bus Real-Time Location",
          "")}
        {Visualcard("https://github.com/ni1o1/UrbanAgglomerationAccessbility",
          "images/UrbanAgglomerationAccessbility.png",
          "Urban Agglomeration Accessibility Analysis System",
          "Accessibility of transportation infrastructure construction")}
        {Visualcard("https://github.com/ni1o1/ODview",
          "images/ODview.png",
          "OD Visualization Tool",
          "Based on FlowMap.gl")}
        {Visualcard("https://github.com/ni1o1/FloodVisualization",
          "images/flood.png",
          "Urban Flood Disaster Analysis System",
          "i3S")}
        {Visualcard("https://github.com/ni1o1/TrajView",
          "images/trajview.png",
          "Trajectory Visualization System",
          "Import data and dynamically visualize trajectories")}
        {Visualcard("https://ni1o1.github.io/activityspace_shanghai/",
          "images/activityshanghai.png",
          "Resident Activity Space Visualization System",
          "Visualize various indicators of resident activities")}
        {Visualcard("https://github.com/ni1o1/amapreachcircle",
          "images/reachcricle.png",
          "Reach Circle",
          "Export reach circles for bus, walking, cycling, and driving from selected map points")}
        {Visualcard("https://github.com/ni1o1/crossing_signal_calculater",
          "images/crossing_signal_calculater.png",
          "Intersection Signal Timing Parameter Calculator",
          "Calculate signal timing parameters for intersections and draw timing diagrams")}
        {Visualcard("https://github.com/ni1o1/advtise-demo",
          "images/advtise-demo.png",
          "Building 3D Shadow Calculation",
          "Visible area of advertisements considering building obstructions")}
        {Visualcard("https://ni1o1.github.io/xiamenmetro/",
          "images/xiamenmetro.png",
          "Xiamen Metro Comprehensive Evaluation System",
          "Visualize various indicators of metro stations")}
        {Visualcard("https://ni1o1.github.io/roadspeedcorr/",
          "images/roadspeedcorr.png",
          "Shanghai Road Network Speed Correlation",
          "Click on the road network to display road speed correlations")}
      </Row>
      <Divider />
      <Title level={4}>ECharts demo</Title>

      <Row gutter={[10, 10]}>
        {Visualcard2("https://ni1o1.github.io/echartsexamples/xiamenhouseprice/",
          "images/厦门二手房价可视化.png",
          "Xiamen Second-Hand House Price Visualization",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/busOD/",
          "images/公交线路OD彩虹图.png",
          "Bus Line OD Rainbow Chart",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/busline/",
          "images/厦门公交线路.png",
          "Xiamen Bus Line 2D Map",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/3dbus/",
          "images/厦门公交线路3D.png",
          "Xiamen Bus Line 3D",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/heatmap/",
          "images/厦门人口热力图.png",
          "Xiamen Population Heatmap",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/3dbuildings/",
          "images/厦门三维城市.png",
          "Xiamen 3D City",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/activity3D/",
          "images/上海居民活动分布3D柱状图.png",
          "Shanghai Resident Activity Distribution 3D Bar Chart",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/intercitytrip/",
          "images/上海南京出行轨迹.png",
          "Shanghai-Nanjing Travel Trajectory",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/weibo/",
          "images/微博转发关系.png",
          "Weibo Repost Relationship",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/2dod/",
          "images/长三角OD不带百度地图.png",
          "Yangtze River Delta OD without Baidu Map",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/oddata/",
          "images/长三角OD带百度地图.png",
          "Yangtze River Delta OD with Baidu Map",
          "")}
        {Visualcard2("https://ni1o1.github.io/echartsexamples/interactiveOD/",
          "images/交互OD.png",
          "Yangtze River Delta Interactive OD Relationship Diagram",
          "")}
      </Row>
            <Paragraph>
        <a href='https://github.com/ni1o1/echartsexamples' target='_blank'>Source code</a>
      </Paragraph>
    </div>
  )
}
