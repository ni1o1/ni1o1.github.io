import React from 'react'
import { Layout, Button, Divider, Avatar, Row, Col, Descriptions, Card, PageHeader, Tag, Typography, Tabs } from 'antd';
import { AntDesignOutlined, GoogleOutlined, MailOutlined, GithubOutlined, YoutubeOutlined } from '@ant-design/icons';
import Introduction from '@/pages/Introduction';
import Publication from '@/pages/Publication';
import Tutorial from '@/pages/Tutorial';
import Visualization from '@/pages/Visualization';
import Opensource from '@/pages/Opensource';
import Heading from '@/component/Heading';
import 'antd/dist/antd.css';
import './index.css';

const { Title, Paragraph, Text, Link } = Typography;
const { Header, Footer, Sider, Content } = Layout;

const { TabPane } = Tabs;

export default function Mainpage() {

  const content = (
    <>
      <Paragraph >
        南方科技大学 计算机科学与工程系 Research Associate
        <br/>
        Southern University of Science and Technology
      </Paragraph>
      <Divider />
      <Descriptions column={{ xs: 3, sm: 1, md: 1 }} colon={false} title="" layout='horizontal'>
        <Descriptions.Item label={<span className="iconfont icon-position" />} >Shanghai</Descriptions.Item>
        <Descriptions.Item label={<GithubOutlined />}><Link href="https://github.com/ni1o1/" target="_blank">Github</Link></Descriptions.Item>
        <Descriptions.Item label={<MailOutlined />}><Link href="mailto:yuq@sustech.edu.cn" target="_blank">Email</Link></Descriptions.Item>
        <Descriptions.Item label={<span className="iconfont icon-researchgate" />} ><Link href="https://www.researchgate.net/profile/Qing_Yu51" target="_blank">ResearchGate</Link></Descriptions.Item>
        <Descriptions.Item label={<GoogleOutlined />}><Link href="https://scholar.google.com/citations?user=7m0xcqEAAAAJ&hl=zh-CN" target="_blank">GoogleScholar</Link></Descriptions.Item>
        <Descriptions.Item label={<span className="iconfont icon-bilibili" />}><Link href="https://space.bilibili.com/3051484" target="_blank">Bilibili</Link></Descriptions.Item>
        <Descriptions.Item label={<YoutubeOutlined />} > <Link href="https://www.youtube.com/channel/UCF0DRqniKUOEMRub8eyRutQ" target="_blank">Youtube</Link></Descriptions.Item>
      </Descriptions>
    </>
  );

  return (
    <>
      <Heading/>
      <Row>
        <Col xs={24} sm={8} md={6} lg={6}>
          <Sider theme='light' width='100%'>
            <PageHeader
              className="site-page-header"
            >
              <Row>
                <Col span={24}>
                  <Avatar size="large" src='images/avatar.jpg' />
                </Col>
              </Row>
              <br />
              <Row>
                <Col span={24}>
                  <Title level={4}>余庆</Title>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <Title level={5}>Yu Qing</Title>
                </Col>
              </Row>
              <Content>
                {content}
              </Content>
            </PageHeader>
          </Sider>
        </Col>
        <Col xs={24} sm={16} md={18} lg={18}>
          <Sider theme='light' width='100%'>
            <Card bordered={false}>
              <Tabs defaultActiveKey="Introduction" size={'large'}>
                <TabPane tab="个人简介" key="Introduction">
                  <Introduction />
                </TabPane>
                <TabPane tab="开源项目" key="Opensource">
                  <Opensource />
                </TabPane>
                <TabPane tab="学术成果" key="Publication">
                  <Publication />
                </TabPane>
                <TabPane tab="可视化项目" key="Visualization">
                  <Visualization />
                </TabPane>
                <TabPane tab="教程" key="Tutorial">
                  <Tutorial />
                </TabPane>
              </Tabs>
            </Card>
          </Sider>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Footer style={{ backgroundColor: 'white', textAlign: 'center' }}>© Copyright 2022, Qing Yu.</Footer>
        </Col>
      </Row>
    </>
  )
}
