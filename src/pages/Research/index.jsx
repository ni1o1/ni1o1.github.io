import React, { useState, useEffect } from 'react';
import { Typography, Col, Row, List, Tag, Select, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import rawResearchData from './researchData.json';
const { Title, Paragraph } = Typography;
const { Option } = Select;

const researchData = rawResearchData.map((item, index) => ({
  ...item,
  id: index + 1,
  textlength: 13, // Default text length
  position: 'left' // Default position
}));

const keywordCounts = rawResearchData.flatMap(item => item.keywords).reduce((acc, keyword) => {
  acc[keyword] = (acc[keyword] || 0) + 1;
  return acc;
}, {});

const allKeywords = [...new Set(rawResearchData.flatMap(item => item.keywords))]
  .sort((a, b) => keywordCounts[b] - keywordCounts[a]);

export default function ResearchPage() {
  const { t, i18n } = useTranslation();
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [filteredResearch, setFilteredResearch] = useState(researchData);

  useEffect(() => {
    if (selectedKeywords.length > 0) {
      setFilteredResearch(
        researchData.filter(item => 
          selectedKeywords.some(keyword => item.keywords.includes(keyword))
        )
      );
    } else {
      setFilteredResearch(researchData);
    }
  }, [selectedKeywords, researchData]); // Added researchData to dependency array

  const handleKeywordChange = (values) => {
    setSelectedKeywords(values);
  };

  const renderItemContent = (item) => {
    const textContent = (
      <Col xs={24} sm={24} md={24} lg={item.textlength} style={{ paddingRight: '10px' }}>
        <Title level={5} style={{ marginBottom: '4px', fontSize: '16px' }}>
          {i18n.language === 'zh' ? item.title_zh : item.title_en}
        </Title>
        <Paragraph style={{ textAlign: 'justify', marginBottom: '8px', fontSize: '13px' }} ellipsis={{ rows: 3, expandable: true, symbol: t('更多') }}>
          {i18n.language === 'zh' ? item.description : item.description_en}
        </Paragraph>
        <div>
          {item.keywords && item.keywords.map((tag) => (
            <Tag key={tag} color="blue" style={{ marginBottom: '4px', fontSize: '12px', padding: '0px 4px' }}>
              {t(tag)} 
            </Tag>
          ))}
        </div>
      </Col>
    );

    const imageContent = (
      <Col xs={24} sm={24} md={24} lg={24 - item.textlength}>
        <img 
          alt={i18n.language === 'zh' ? item.title_zh : item.title_en} 
          src={item.imgpath} 
          style={{ 
            objectFit: 'cover', 
            width: '100%', 
            height: '180px', // Reduced height for compactness
            borderRadius: '4px' // Reduced border radius
          }} 
        />
      </Col>
    );

    if (item.position === 'right') {
      return <Row gutter={[20, 20]} align="middle">{imageContent}{textContent}</Row>;
    } 
    return <Row gutter={[20, 20]} align="middle">{textContent}{imageContent}</Row>; 
  };

  return (
    <Typography style={{ padding: '10px 20px' }}>
      <Row gutter={[16,16]} align="middle" style={{ marginBottom: '15px' }}>
        <Col xs={24} sm={24} md={8} lg={6} xl={5}>
          <Title level={3} style={{ margin: 0, fontSize: '20px' }}>{t('代表性成果')}</Title>
        </Col>
        <Col xs={24} sm={24} md={16} lg={18} xl={19}>
          <Select
            mode="multiple"
            placeholder={t('关键词筛选')}
            onChange={handleKeywordChange}
            allowClear
            style={{ width: '50%' }}
          >
            {allKeywords.map(keyword => (
              <Option key={keyword} value={keyword}>{t(keyword)}</Option>
            ))}
          </Select>
        </Col>
      </Row>

      <List
        grid={{ gutter: 24, xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }} // Ensure one item per row, but Card will handle layout
        dataSource={filteredResearch}
        renderItem={item => (
          <List.Item key={item.id} style={{padding: '0px 0'}}>
            <a href={item.src} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none'}}>
              <Card 
                hoverable 
                style={{ 
                  width: '100%', 
                  marginBottom: '12px', // Reduced margin
                  borderRadius: '6px', // Reduced border radius
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)' // Softer shadow
                }}
                bodyStyle={{ padding: '12px' }} // Reduced card padding
              >
                {renderItemContent(item)}
              </Card>
            </a>
          </List.Item>
        )}
        pagination={{
          pageSize: 5,
          showSizeChanger: false,
        }}
      />
    </Typography>
  );
}