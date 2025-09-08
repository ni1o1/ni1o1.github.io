// ResearchPage.jsx (Refactored for Compact Layout)

import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, List, Tag, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import AV from 'leancloud-storage';
import LikeDislike from '../../LikeDislike';

const { Title } = Typography;
const { Option } = Select;

export default function ResearchPage() {
  const { t, i18n } = useTranslation();
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [researchData, setResearchData] = useState([]);
  const [filteredResearch, setFilteredResearch] = useState([]);
  const [allKeywords, setAllKeywords] = useState([]);
  const [keywordCounts, setKeywordCounts] = useState({});
  const [loading, setLoading] = useState(true);
  
  // 添加新 state 来存储批量获取的数据
  const [ratingsMap, setRatingsMap] = useState(new Map());

  // 加载研究数据
  useEffect(() => {
    const fetchResearchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/research/index.json');
        const data = await response.json();
        
        setResearchData(data);
        setFilteredResearch(data);
        
        // 计算关键词统计
        const counts = data.flatMap(item => item.keywords).reduce((acc, keyword) => {
          acc[keyword] = (acc[keyword] || 0) + 1;
          return acc;
        }, {});
        setKeywordCounts(counts);
        
        // 生成排序后的关键词列表
        const keywords = [...new Set(data.flatMap(item => item.keywords))]
          .sort((a, b) => counts[b] - counts[a]);
        setAllKeywords(keywords);
        
      } catch (error) {
        console.error('Failed to load research data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResearchData();
  }, []);
  
  // 批量获取所有成果的点赞数据
  useEffect(() => {
    const itemIds = researchData.map(item => item.id);
    if (itemIds.length === 0) return;

    const fetchAllRatings = async () => {
      try {
        const query = new AV.Query('Ratings');
        query.containedIn('itemId', itemIds);
        query.limit(1000);
        const results = await query.find();
        
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
  }, [researchData]);

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

  return (
    <Typography style={{ padding: '10px 20px' }}>
      {/*<Row gutter={[16,16]} align="middle" style={{ marginBottom: '15px' }}>
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
      </Row>*/}

      <List
        itemLayout="vertical"
        size="small"
        dataSource={filteredResearch}
        loading={loading}
        pagination={{
        
          pageSize: 100,
          showSizeChanger: false,
        }}
        renderItem={item => {
          const ratingData = ratingsMap.get(item.id) || { likes: 0, dislikes: 0, objectId: null };
          
          return (
            <List.Item 
              key={item.id} 
              style={{ 
                padding: '8px 0', 
                borderBottom: '1px solid #f0f0f0',
                margin: 0
              }}
            >
              <Row gutter={[16, 8]} align="top">
                <Col xs={24} sm={24} md={16} lg={18}>
                  <a 
                    href={item.src} 
                    target="_blank" 
                    style={{
                    color: '#1890ff',
                    margin: 12 ,
        fontSize: '17px',
        margin: 0,
        lineHeight: 1.5,
      }}>
                  
                    {i18n.language === 'zh' ? item.title_zh : item.title_en}
                  </a>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#555', 
                    lineHeight: 1.4,
                    marginBottom: '6px',
                    maxHeight: '42px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {i18n.language === 'zh' ? item.description : item.description_en}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {item.keywords && item.keywords.map((tag) => (
                      <Tag 
                        key={tag} 
                        color="blue" 
                        style={{ 
                          margin: 0, 
                          fontSize: '11px', 
                          padding: '0 6px',
                          height: '20px',
                          lineHeight: '20px'
                        }}
                      >
                        {t(tag)} 
                      </Tag>
                    ))}
                    <LikeDislike 
                      itemId={item.id} 
                      initialLikes={ratingData.likes}
                      initialDislikes={ratingData.dislikes}
                      objectId={ratingData.objectId}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={24} md={8} lg={6}>
                  <img 
                    alt={i18n.language === 'zh' ? item.title_zh : item.title_en} 
                    src={item.imgpath} 
                    style={{ 
                      objectFit: 'cover', 
                      width: '100%', 
                      height: '120px', 
                      borderRadius: '4px',
                      marginTop: '4px'
                    }} 
                  />
                </Col>
              </Row>
            </List.Item>
          );
        }}
      />
    </Typography>
  );
}