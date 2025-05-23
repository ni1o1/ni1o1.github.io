import React, { useEffect, useState } from 'react';
import { Typography, List, Tag, Space, Skeleton, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ViewCounter from '../../ViewCounter'; // 1. 导入 ViewCounter 组件
import LikeDislike from '../../LikeDislike'; 
export default function News() {

  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    axios.get('posts/allposts.json').then(res => {
      const files = res.data;
      setNews(files.posts.filter(f => f.show).sort((a, b) => new Date(b.date) - new Date(a.date)));
    })
  }, [])

  return (
    <List
      itemLayout="vertical"
      size="large"
      dataSource={news}
      pagination={{
        pageSize: 10,
      }}
      renderItem={(item, index) => (
        <List.Item key={item.filename} style={{ marginBottom: '16px', padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
          <List.Item.Meta
            title={<a onClick={() => {
              navigate(`/news/${item.filename}`)
            }}>{i18n.language == 'zh' ? item.title : item.title_en}
            </a>}
            description={<Space>

              <span>{item.date}</span>
              <ViewCounter itemId={item.filename} />
              <LikeDislike itemId={item.filename} />
              <div>
                {item.tags && item.tags.map((f, tagIndex) => (
                  <Tag key={f} bordered={false} color="blue">
                    {t(f)}
                  </Tag>))}
              </div>
              
            </Space>}
          />
          {i18n.language == 'zh' ? item.brief : item.brief_en}
        </List.Item>
      )}
    />
  );
}