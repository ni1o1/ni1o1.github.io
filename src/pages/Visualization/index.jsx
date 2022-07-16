import React from 'react'
import { Card, Row, Col, Typography, Divider } from 'antd';

const { Meta } = Card;
const { Title, Paragraph } = Typography;


export default function Visualization() {

  function Visualcard(src, imgpath, title, description) {
    return <Col span={8} xs={24} sm={24} md={24} lg={12} xl={8} xxl={6}>
      <a href={src}>
        <Card
          hoverable
          bordered={false}
          size='small'
          cover={<img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'cover' }} height='150' />}
          type = 'inner'
        >
          
          {/* <Meta title={title} description={description} /> */}
        </Card>
      </a>
    </Col>
  }
  function Visualcard2(src, imgpath, title, description) {
    return <Col span={8} xs={24} sm={24} md={12} lg={12} xl={8} xxl={6}>
      <a href={src}>
        <Card
          hoverable
          bordered={false}
          size='small'
          cover={<img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'cover' }} height='150' />}
        >
          {/* <Meta title={title} description={description} /> */}
        </Card>
      </a>
    </Col>
  }
  return (
    <div style={{ margin: 12 }}>
      <Title level={2}>可视化项目</Title>
      <Row gutter={[10, 10]}>
        {Visualcard("https://github.com/ni1o1/UrbanAgglomerationAccessbility",
          "images/UrbanAgglomerationAccessbility.png",
          "城市群可达性分析系统",
          "快速评估交通基础设施建设的可达性提升")}
          {Visualcard("https://github.com/ni1o1/ODview",
          "images/ODview.png",
          "OD可视化工具",
          "基于FlowMap.gl")}
                  {Visualcard("https://github.com/ni1o1/FloodVisualization",
          "images/flood.png",
          "城市洪涝灾害分析系统",
          "i3S")}
        {Visualcard("https://github.com/ni1o1/TrajView",
          "images/trajview.png",
          "轨迹可视化系统",
          "导入数据，动态可视化轨迹")}
        {Visualcard("https://ni1o1.github.io/activityspace_shanghai/",
          "images/activityshanghai.png",
          "居民活动空间可视化系统",
          "居民活动各类指标可视化")}
        {Visualcard("https://github.com/ni1o1/amapreachcircle",
          "images/reachcricle.png",
          "到达圈",
          "地图选点导出公交步行骑行驾车到达圈")}
        {Visualcard("https://github.com/ni1o1/crossing_signal_calculater",
          "images/crossing_signal_calculater.png",
          "交叉口信号配时参数计算器",
          "计算信号交叉口配时参数并绘制配时图")}
        {Visualcard("https://github.com/ni1o1/advtise-demo",
          "images/advtise-demo.png",
          "建筑三维阴影计算",
          "考虑建筑遮挡的广告可视范围")}
        {Visualcard("https://ni1o1.github.io/xiamenmetro/",
          "images/xiamenmetro.png",
          "厦门轨道综合评价系统",
          "轨道站点各类指标可视化")}
        {Visualcard("https://ni1o1.github.io/roadspeedcorr/",
          "images/roadspeedcorr.png",
          "上海市路网车速关联性",
          "点击路网显示道路车速关联性")}
      </Row>
      <Divider />
      <Title level={2}>ECharts demo</Title>
      <Paragraph>
        Demo的源码在此<a href='https://github.com/ni1o1/echartsexamples' target='_blank'>项目</a>中
      </Paragraph>
      <Row gutter={[10, 10]}>
      
      {Visualcard2("https://ni1o1.github.io/echartsexamples/xiamenhouseprice/",
          "images/厦门二手房价可视化.png",
          "厦门二手房价可视化",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/busOD/",
          "images/公交线路OD彩虹图.png",
          "公交线路OD彩虹图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/busline/",
          "images/厦门公交线路.png",
          "厦门公交线路二维地图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/3dbus/",
          "images/厦门公交线路3D.png",
          "厦门公交线路3D",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/heatmap/",
          "images/厦门人口热力图.png",
          "厦门人口热力图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/3dbuildings/",
          "images/厦门三维城市.png",
          "厦门三维城市",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/activity3D/",
          "images/上海居民活动分布3D柱状图.png",
          "上海居民活动分布3D柱状图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/intercitytrip/",
          "images/上海南京出行轨迹.png",
          "上海南京出行轨迹",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/weibo/",
          "images/微博转发关系.png",
          "微博转发关系",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/2dod/",
          "images/长三角OD不带百度地图.png",
          "长三角OD不带百度地图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/oddata/",
          "images/长三角OD带百度地图.png",
          "长三角OD带百度地图",
          "")}
          {Visualcard2("https://ni1o1.github.io/echartsexamples/interactiveOD/",
          "images/交互OD.png",
          "长三角OD可交互关系图",
          "")}
      </Row>
    </div>
  )
}
