import React from 'react'
import { Card, Row, Col } from 'antd';

const { Meta } = Card;

export default function Opensource() {
  function viscard(herf, src, title, description) {
    return <a href={herf}>
      <Card
        hoverable
        size='small'
        style={{ margin: 24 }}
        cover={<img alt="transbigdata" src={src} style={{ 'object-fit': 'contain' }} height='100' />}
      >
        <Meta title={title} description={description} />
      </Card>
    </a>
  }
  return (
    <>
      {viscard("https://github.com/ni1o1/transbigdata", "images/logo-wordmark-dark-small.png", "TransBigData", "交通时空大数据处理、分析和可视化的Python包")}
      {viscard("https://github.com/ni1o1/pybdshadow", "images/pybdshadow.png", "pybdshadow", "计算建筑物阴影")}
      {viscard("https://github.com/ni1o1/plot_map", "images/plot_map.png", "plot_map", "在matplotlib上绘制地图底图")}
    </>
  )
}
