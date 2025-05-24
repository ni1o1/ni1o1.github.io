// ResearchPage.jsx (Refactored for Batch Fetching)

import React, { useState, useEffect } from 'react'; // 1. 确保导入 useEffect 和 useState
import { Typography, Col, Row, List, Tag, Select, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import AV from 'leancloud-storage'; // 2. 导入 AV
import rawResearchData from './researchData.json';
import LikeDislike from '../../LikeDislike';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const researchData = rawResearchData.map((item, index) => ({
  ...item,
  textlength: 13,
  position: 'left'
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
  
  // 3. 添加新 state 来存储批量获取的数据
  const [ratingsMap, setRatingsMap] = useState(new Map());

  // 4. 新增 useEffect 用于批量获取所有成果的点赞数据
  useEffect(() => {
    const itemIds = researchData.map(item => item.id);
    if (itemIds.length === 0) return;

    const fetchAllRatings = async () => {
      try {
        const query = new AV.Query('Ratings');
        query.containedIn('itemId', itemIds); // 使用 containedIn 一次性查询所有
        query.limit(1000); // 如果成果超过100个，需要设置 limit
        const results = await query.find();
        
        // 将结果转换为一个 Map，方便快速查找
        const newRatingsMap = new Map(results.map(item => [item.get('itemId'), {
          likes: item.get('likes') || 0,
          dislikes: item.get('dislikes') || 0,
          objectId: item.id
        }]));
        
        setRatingsMap(newRatingsMap);
      } catch (error) {
        console.error("Failed to batch fetch ratings:", error);
      }
    };
    
    fetchAllRatings();
  }, []); // 空依赖数组意味着这个 effect 只在组件首次加载时运行一次

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
  }, [selectedKeywords]);

  const handleKeywordChange = (values) => {
    setSelectedKeywords(values);
  };

  const renderItemContent = (item) => {
    // 5. 从 state Map 中为当前项查找点赞数据
    const ratingData = ratingsMap.get(item.id) || { likes: 0, dislikes: 0, objectId: null };

    const textContent = (
      <Col xs={24} sm={24} md={24} lg={item.textlength} style={{ paddingRight: '10px' }}>
        <a href={item.src} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }} className="research-title-link">
          <Title level={5} style={{ marginBottom: '4px', fontSize: '16px' }}>
            {i18n.language === 'zh' ? item.title_zh : item.title_en}
          </Title>
        </a>
        <Paragraph style={{ textAlign: 'justify', marginBottom: '8px', fontSize: '13px' }} ellipsis={{ rows: 3, expandable: true, symbol: t('更多') }}>
          {i18n.language === 'zh' ? item.description : item.description_en}
        </Paragraph>
        <div>
          {item.keywords && item.keywords.map((tag) => (
            <Tag key={tag} color="blue" style={{ marginBottom: '4px', fontSize: '12px', padding: '0px 4px' }}>
              {t(tag)} 
            </Tag>
          ))}
          {/* 6. 将获取到的数据作为 props 传入 LikeDislike 组件 */}
          <LikeDislike 
            itemId={item.id} 
            initialLikes={ratingData.likes}
            initialDislikes={ratingData.dislikes}
            objectId={ratingData.objectId}
          />
        </div>
      </Col>
    );

    const imageContent = (
      <Col xs={24} sm={24} md={24} lg={24 - item.textlength}>
        <img 
          alt={i18n.language === 'zh' ? item.title_zh : item.title_en} 
          src={item.imgpath} 
          style={{ objectFit: 'cover', width: '100%', height: '180px', borderRadius: '4px' }} 
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
              <Option key={keyword} value={keyword}>
                {t(keyword)} <span style={{fontSize: '12px', color: '#999'}}>({keywordCounts[keyword]}{t(' 篇')})</span>
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      <List
        grid={{ gutter: 24, xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }}
        dataSource={filteredResearch}
        renderItem={item => (
          <List.Item key={item.id} style={{padding: '0px 0'}}>
              <Card 
                style={{ width: '100%', marginBottom: '12px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}
                bodyStyle={{ padding: '12px' }}
              >
                {renderItemContent(item)}
              </Card>
          </List.Item>
        )}
        pagination={{
          position: 'both',
          pageSize: 5,
          showSizeChanger: false,
        }}
      />
    </Typography>
  );
}