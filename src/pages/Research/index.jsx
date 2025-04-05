import React, { useEffect, useState } from 'react';
import { Typography, Divider, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import Researchgraph from '@/component/Researchgraph';
const { Title, Paragraph, Text, Link } = Typography;


export default function Publication() {
  const { t,i18n } = useTranslation();


  function research(title, description, imgpath, src, textlength, position) {
    const content = (<Col xs={24} sm={24} md={24} lg={textlength}>
      <Title level={4}>{title}</Title>
      <Paragraph>
        {description}
      </Paragraph>
    </Col>)
    const img = (<Col xs={24} sm={24} md={24} lg={24 - textlength}>
      <img alt="transbigdata" src={imgpath} style={{ 'object-fit': 'contain' }} width='100%' height='400px' />
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
        <Row gutter={[20, 20]}>
          {totalcontent}
        </Row>
        <Divider dashed />
      </a>
    </>)
  }
  return (
    <Typography>
      {/* <Researchgraph/> */}
      <Divider orientation="left"><Title level={3}>{t("交通能源与排放")}</Title></Divider>
      
      {research(
        'Potential and flexibility analysis of electric taxi fleets V2G system based on trajectory data and agent-based modeling',
        'We studied the Vehicle-to-Grid (V2G) potential of electric taxis, developing a framework to analyze charging and energy use. Our model, applied to 19,900 taxis in Shenzhen, shows significant peak power supply and quick recovery, promoting efficient energy management.',
        'images/research/v2g.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261923016872',
        9,
        'left'
      )}
      {research(
        'Modeling electric vehicle behavior: Insights from long-term charging and energy consumption patterns through empirical trajectory data',
        'We studied the regular charging patterns and potential demand of electric vehicles in spatial and temporal dimensions through long-term empirical data analysis and classification of charging behaviors of different types of electric vehicles.',
        'images/research/EVmodeling.jpg',
        'https://www.sciencedirect.com/science/article/pii/S0306261924024504',
        10,
        'right'
      )}
      {research(
        'GPS data in taxi-sharing system: Analysis of potential demand and assessment of fuel consumption based on routing probability model',
        'We developed a taxi-sharing system using probability-based matching algorithms to combine trips, aiming to reduce fuel consumption. Testing different strategies, we found it could decrease idle time but potentially increase traffic in busy urban spots.',
        'images/research/taxisharing.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261922003452',
        9,
        'left'
      )}

<Divider orientation="left"><Title level={3}>{t("城市环境与数字孪生")}</Title></Divider>
      {research(
        'AdvMOB: Interactive visual analytic system of billboard advertising exposure analysis based on urban digital twin technique',
        'We developed AdvMOB, an interactive visual analytics system to assess billboard advertising exposure in urban environments. It integrates personal information and trajectory data to accurately measure the impact of individual billboards, providing comprehensive evaluation and comparison of exposure through an intuitive interface. This system has the potential to significantly improve the design of billboard advertisements by delivering nuanced insights and comprehensive support.',
        'images/research/advmob.png',
        'https://www.sciencedirect.com/science/article/pii/S1474034624004774',
        10,
        'left'
      )}
      {research(
        'Real-time gas explosion prediction at urban scale by GIS and graph neural network',
        'We developed an integrated GIS and graph neural network approach to accurately predict the consequences of gas explosions in urban areas, offering a 1000-fold speed improvement over CFD methods. Our model, with an R2 of 0.946 and MSE of 5.36E-4, enhances urban resilience planning during energy transitions.',
        'images/research/explode.jpg',
        'https://www.sciencedirect.com/science/article/pii/S0306261924019974',
        13,
        'right'
      )}

      <Divider orientation="left"><Title level={3}>{t("共享交通")}</Title></Divider>
      {research(
        'GPS data in urban bicycle-sharing: Dynamic electric fence planning with assessment of resource-saving and potential energy consumption increasement',
        'We use an agent-based model to simulate trips and compare the effectiveness of static versus dynamic electric fences. Results indicate that dynamic fences reduce walking distances, enhance parking order in city centers, and improve resource efficiency, saving 25.31% in bicycle resources. Additionally, dynamic fences decrease energy consumption by 5.79% daily compared to static fences.',
        'images/research/bikesharing.png',
        'https://www.sciencedirect.com/science/article/pii/S0306261922008509',
        9,
        'right'
      )}
      {research(
        'Enhancing carbon efficiency in shared micro-mobility systems: An agent-based fleet size and layout assessment approach',
        'We created a model to evaluate carbon benefits of shared bike scales, finding that a fleet of 4500–7500 bikes in a 100 km2 area can reduce weekly CO2 emissions by 10,000–11,000 kg, guiding sustainable SMMS planning.',
        'images/research/bsjclp.png',
        'https://www.sciencedirect.com/science/article/pii/S0959652624006565',
        9,
        'left'
      )}

    </Typography >
  )
}
