import React from 'react'
import { Layout, Button, Divider, Avatar, Row, Col, List, Card, Typography, Tabs } from 'antd';
import { PageHeader } from '@ant-design/pro-components';
import { AntDesignOutlined, TranslationOutlined, GoogleOutlined, MailOutlined, GithubOutlined, YoutubeOutlined } from '@ant-design/icons';
import Introduction from '@/pages/Introduction';
import Publication from '@/pages/Publication';
import Projects from '@/pages/Projects';
import Research from '@/pages/Research';
import Group from '@/pages/Group';
import News from '@/pages/News';
import NewsDetail from '@/pages/News/NewsDetail';
import Heading from '@/component/Heading';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import './github-markdown-light.css';
//import 'antd/dist/antd.css';
import { useTranslation } from 'react-i18next';
import './index.css';

const { Title, Paragraph, Text, Link } = Typography;
const { Header, Footer, Sider, Content } = Layout;

export default function Mainpage() {
  const { t, i18n } = useTranslation();

  const content = (
    <>
      <Paragraph >
        {t('博士后')}
        <br />
        {t('北京大学城市规划与设计学院')}
        <br />
        {t('智慧城市实验室')}
      </Paragraph>
      <Divider />
      <List style={{ padding: 0 }}>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>

          <span style={{ textAlign: 'left' }}><span className="iconfont icon-position" style={{ marginRight: 8 }} />{t('深圳')}</span>
        </List.Item>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>

          <Link href="mailto:yuq@pku.edu.cn" target="_blank" style={{ textAlign: 'left' }}><MailOutlined style={{ marginRight: 8 }} /> yuq@pku.edu.cn</Link>
        </List.Item>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>

          <Link href="https://github.com/ni1o1/" target="_blank" style={{ textAlign: 'left' }}> <GithubOutlined style={{ marginRight: 8 }} />Github</Link>
        </List.Item>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>

          <Link href="https://www.researchgate.net/profile/Qing_Yu51" target="_blank" style={{ textAlign: 'left' }}><span className="iconfont icon-researchgate" style={{ marginRight: 8 }} />ResearchGate</Link>
        </List.Item>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>

          <Link href="https://scholar.google.com/citations?user=7m0xcqEAAAAJ&hl=zh-CN" target="_blank" style={{ textAlign: 'left' }}><GoogleOutlined style={{ marginRight: 8 }} />{t('谷歌学术')}</Link>
        </List.Item>
        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>
          <Link href="https://space.bilibili.com/3051484" target="_blank" style={{ textAlign: 'left' }}><span className="iconfont icon-bilibili" style={{ marginRight: 8 }} />{t('哔哩哔哩')}</Link>
        </List.Item>
      </List>
    </>
  );
  const bgc = '#fff';

  const navigate = useNavigate();

  return (

    <div style={{
      'backgroundColor': bgc,
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      margin: 0,
      padding: 0
    }}>
      <div style={{ display: 'flex', flex: 1, margin: 0 }}>
        <div style={{ width: '300px', maxWidth: '300px', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <Card variant="borderless" style={{ 'backgroundColor': bgc, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <Sider theme='light' width='100%' style={{ height: '100%', background: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <PageHeader
                className="site-page-header"
              >
                <div>
                  <Avatar size="large" style={{ width: 100, height: 100 }} src='images/avatar.jpg' />
                </div>
                <br />
                <div>
                  <Title level={4}>{t('余庆')} </Title>
                </div>
                <Content>
                  {content}
                </Content>
              </PageHeader>
            </Sider>
          </Card>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
          <Card variant="borderless" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <Tabs defaultActiveKey="intro" size={'large'}
              tabBarExtraContent={
                <Button type='primary' onClick={() => { i18n.changeLanguage(i18n.language == 'en' ? 'zh' : 'en') }}
                >{i18n.language == 'en' ? '中文' : 'English'}</Button>
              }
              onTabClick={(key) => {
                navigate(`/${key}`)
              }}
              items={[
                { label: t("简介"), key: 'intro' },
                { label: t("新闻"), key: 'news' },
                { label: t("研究"), key: 'research' },
                { label: t("论著"), key: 'publication' },
                { label: t("开源"), key: 'projects' },
                { label: t("团队"), key: 'group' }
              ]}
            />
            <Routes>
              <Route path="/" element={<Introduction />} />
              <Route path="/intro" element={<Introduction />} />
              <Route path="/news" element={<News />} />
              <Route path="/research" element={<Research />} />
              <Route path="/publication" element={<Publication />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/group" element={<Group />} />
              <Route path="/news/:filename" element={<NewsDetail />} />
            </Routes>
          </Card>
        </div>
      </div>
      <Row>
        <Col span={24}>
          <Footer style={{ backgroundColor: '#ffffff', textAlign: 'center' }}>{t("版权所有")} © 2025 {t("北京大学智慧城市实验室")} | yuq@pku.edu.cn
            <br />
            <img className="headimg" src="heading/heading.png" style={{
              'margin': '10px',
              'right': '0',
              objectFit: 'contain'
            }} height='40' ></img>
          </Footer>
        </Col>
      </Row>

    </div>

  )
}
