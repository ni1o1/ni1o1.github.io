import React from 'react'
import { Layout, Button, Divider, Avatar, Row, Col, Descriptions, Card, PageHeader, Tag, Typography, Tabs } from 'antd';
import { AntDesignOutlined, GoogleOutlined, MailOutlined, GithubOutlined, YoutubeOutlined } from '@ant-design/icons';
import Introduction from '@/pages/Introduction';
import Publication from '@/pages/Publication';
import Projects from '@/pages/Projects';
import Research from '@/pages/Research';
import Group from '@/pages/Group';
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
        Ph. D. /Postdoctor
        <br />
        北京大学城市规划与设计学院 | School of Urban Planning & Design, Peking University Shenzhen
        <br />
        智慧城市实验室 | Smart City Lab 
      </Paragraph>
      <Divider />
      <Descriptions column={{ xs: 3, sm: 1, md: 1 }} colon={false} title="" layout='horizontal' >
        <Descriptions.Item label={<span className="iconfont icon-position" />} >Shenzhen</Descriptions.Item>
        <Descriptions.Item label={<MailOutlined />}><Link href="mailto:yuq@pku.edu.cn" target="_blank">Email: yuq@pku.edu.cn</Link></Descriptions.Item>
        <Descriptions.Item label={<GithubOutlined />}><Link href="https://github.com/ni1o1/" target="_blank">Github</Link></Descriptions.Item>
        <Descriptions.Item label={<span className="iconfont icon-researchgate" />} ><Link href="https://www.researchgate.net/profile/Qing_Yu51" target="_blank">ResearchGate</Link></Descriptions.Item>
        <Descriptions.Item label={<GoogleOutlined />}><Link href="https://scholar.google.com/citations?user=7m0xcqEAAAAJ&hl=zh-CN" target="_blank">GoogleScholar</Link></Descriptions.Item>
        <Descriptions.Item label={<span className="iconfont icon-bilibili" />}><Link href="https://space.bilibili.com/3051484" target="_blank">Bilibili</Link></Descriptions.Item>
        <Descriptions.Item label={<YoutubeOutlined />} > <Link href="https://www.youtube.com/channel/UCF0DRqniKUOEMRub8eyRutQ" target="_blank">Youtube</Link></Descriptions.Item>
      </Descriptions>
    </>
  );
const bgc = '#fff';
  return (
    <div style={{'backgroundColor':bgc}}>
      <Row  >
        <Col xs={24} sm={8} md={6} lg={6}>
          <Card bordered={false}  style={{'backgroundColor':bgc}}>
            <Sider theme='light' width='100%'>
              <PageHeader
                className="site-page-header"
              >
                <Row>
                  <Col span={24}>
                    <Avatar size="large" style={{ width: 100, height: 100 }} src='images/avatar.jpg' />
                  </Col>
                </Row>
                <br />
                <Row>
                  <Col span={24}>
                    <Title level={4}>余庆 | Qing Yu </Title>
                  </Col>
                </Row>
                <Content>
                  {content}
                </Content>
              </PageHeader>
            </Sider>
          </Card>
         
        </Col>
        <Col xs={24} sm={16} md={18} lg={18}>

            <Sider theme='light' width='100%'>
            <Card bordered={false}>
              <Tabs defaultActiveKey="Introduction" size={'large'}>
                <TabPane tab="简介 | Introduction" key="Introduction">
                  <Introduction />
                </TabPane>
                <TabPane tab="研究 | Research" key="Research">
                  <Research />
                </TabPane>
                <TabPane tab="文章 | Publication" key="Publication">
                  <Publication />
                </TabPane>
                <TabPane tab="开源 | Open Source" key="Projects">
                  <Projects />
                </TabPane>
                <TabPane tab="研究组 | Group" key="Group">
                  <Group />
                </TabPane>
              </Tabs>
              </Card>
            </Sider>

        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Footer style={{ backgroundColor: bgc, textAlign: 'center' }}>Copyright © 2024 Peking University Shenzhen Graduate School | yuq@pku.edu.cn</Footer>
        </Col>
      </Row>
      <img src="https://visitor-badge.laobi.icu/badge?page_id=ni1o1githubio" alt="visitor badge" style={{ 'visibility': 'hidden' }} />
    </div>
  )
}
