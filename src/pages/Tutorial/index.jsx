import React from 'react'
import { Card, Row, Col,Typography,Divider } from 'antd';
const { Meta } = Card;
const { Title, Paragraph, Text, Link } = Typography;
export default function Tutorial() {
  function Visualcard(src, imgpath, title, description) {
    return <Col span={8} xs={24} sm={24} md={12} lg={12} xl={8} xxl={6}>
      <a href={src}>
        <Card
          hoverable
          bordered={false}
          size='small'
          cover={<img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'cover' }} height='150' />}
        >
          <Meta title={title} description={description}/>
        </Card>
      </a>
    </Col>

  }

  return (
    <div style={{ margin:12 }}>
       <Title level={2}>Python时空大数据</Title>
    <Row gutter={[10,10]}>
      {Visualcard("https://www.bilibili.com/video/BV1Gr4y1q7F9", 
      "images/python1.webp", 
      "Python时空大数据-零基础",
      "零基础入门Python时空大数据分析")}
       {Visualcard("https://www.bilibili.com/video/BV1A5411a7xz", 
      "images/python2.webp", 
      "Python时空大数据-入门",
      "出租车GPS数据处理")}
      {Visualcard("https://www.bilibili.com/video/BV1Eb4y1S7HC", 
      "images/python3.webp", 
      "Python时空大数据-进阶",
      "交通大数据分析实战")}
    </Row>
    
    <Divider />
    <Title level={2}>算法讲座</Title>
    <Row gutter={[10,10]}>
    {Visualcard("https://www.bilibili.com/video/BV1E5411E71z", 
      "images/pca.webp", 
      "PCA",
      "什么是主成分分析PCA")}
    {Visualcard("https://www.bilibili.com/video/BV16A411T7zX", 
      "images/svd.webp", 
      "SVD",
      "什么是奇异值分解SVD")}
     {Visualcard("https://www.youtube.com/watch?v=ZERIZsxk5XQ", 
      "images/autocorr.webp", 
      "空间自相关",
      "什么是空间自相关和热点分析")}
    </Row>

    <Divider />
    <Title level={2}>数据可视化</Title>
    <Row gutter={[10,10]}>
    {Visualcard("https://www.bilibili.com/video/BV1E3411z7mb", 
      "images/visualization.webp", 
      "数据可视化",
      "大数据博士教你数据可视化")}
    </Row>
  </div>
  )
}
