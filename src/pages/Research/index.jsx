import React, { useEffect, useState } from 'react';
import { Typography, Divider, Col, Row } from 'antd';

const { Title, Paragraph, Text, Link } = Typography;


export default function Publication() {


  function research(title, description, imgpath, src, textlength, position) {
    const content = (<Col xs={24} sm={24} md={24} lg={textlength}>
      <Title level={4}>{title}</Title>
      <Paragraph>
        {description}
      </Paragraph>
    </Col>)
    const img = (<Col xs={24} sm={24} md={24} lg={24 - textlength}>
      <img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'contain' }} width='100%' height='300px' />
    </Col>)
    let totalcontent
    if (position == 'left') {
      totalcontent = (<>
        {content}
        {img}
      </>)
    } else if (position == 'right') {
      totalcontent = (<>
        {img}
        {content}

      </>)
    }
    return (<>
      <a href={src} target='_blank'>
        <br />
        <Row gutter={[20, 20]}>
          {totalcontent}
        </Row>
        <br />
      </a>
    </>)
  }
  return (
    <Typography>
      <Title level={1}>Research Interests</Title>

      <Title level={2}>Transportation Energy and Emissions</Title>
      {research(
        'Potential and flexibility analysis of electric taxi fleets V2G system based on trajectory data and agent-based modeling',
        'We conducted a study to analyze the potential and flexibility of electric taxi fleets using Vehicle-to-Grid (V2G) technology. By utilizing real-world electric taxi trajectory data, we developed a framework to infer vehicle charging, energy consumption, and State of Charge (SoC) reconstruction. We established a V2G potential estimation model for individual electric taxis and used an agent-based model to simulate system flexibility during various V2G events. Our methodology was applied to 19,900 electric taxis in Shenzhen over a month, revealing the V2G system’s ability to supply significant power during peak periods and recover within a short time without disrupting regular operations, highlighting the potential for more efficient and sustainable energy management.',
        'images/research/v2g.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261923016872',
        9,
        'left'
      )}
      {research(
        'GPS data in taxi-sharing system: Analysis of potential demand and assessment of fuel consumption based on routing probability model',
        'We presents a framework to design an efficient taxi-sharing system using driver routing probability-based matching and dispatching algorithms. Our method matches multiple taxi trips into shared routes, considering time and location feasibility. We examine three scenarios with varying operational strategies to assess potential improvements in efficiency and fuel consumption reduction. Results indicate that while taxi-sharing can reduce overall fuel consumption by minimizing idle trips, it may increase traffic in high-demand urban areas, particularly around key intersections.',
        'images/research/taxisharing.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261922003452',
        9,
        'right'
      )}
      <Divider />

      <Title level={2}>Urban Environment and Digital Twin</Title>
      {research(
        'AdvMOB: Interactive visual analytic system of billboard advertising exposure analysis based on urban digital twin technique',
        'We developed AdvMOB, an interactive visual analytics system to assess billboard advertising exposure in urban environments. It integrates personal information and trajectory data to accurately measure the impact of individual billboards, providing comprehensive evaluation and comparison of exposure through an intuitive interface. This system has the potential to significantly improve the design of billboard advertisements by delivering nuanced insights and comprehensive support.',
        'images/research/advmob.png',
        'https://www.sciencedirect.com/science/article/pii/S1474034624004774',
        8,
        'left'
      )}
      <Divider />

      <Title level={2}>Sharing Transportation</Title>
      {research(
        'GPS data in urban bicycle-sharing: Dynamic electric fence planning with assessment of resource-saving and potential energy consumption increasement',
        'We use an agent-based model to simulate trips and compare the effectiveness of static versus dynamic electric fences. Results indicate that dynamic fences reduce walking distances, enhance parking order in city centers, and improve resource efficiency, saving 25.31% in bicycle resources. Additionally, dynamic fences decrease energy consumption by 5.79% daily compared to static fences.',
        'images/research/bikesharing.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261922008509',
        9,
        'right'
      )}
      <Divider />

    </Typography >
  )
}
