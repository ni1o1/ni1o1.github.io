// Introduction.js
import React, { useEffect, useState } from 'react';
import { Typography, List, Tag, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Intro() {

  const navigate = useNavigate();
  const [news, setNews] = useState([]);

  useEffect(() => {
    axios.get('posts/allposts.json').then(res => {
      const files = res.data;
      setNews(files.posts.sort((a, b) => new Date(b.date) - new Date(a.date)));
    })
  }, [])

  return (
    <>
      <Typography>
        <List
          itemLayout="vertical"
          size="large"
          dataSource={news}
          pagination={{
            pageSize: 3,
          }}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                title={<a onClick={() => {
                  navigate(`/news/${item.filename}`)
                }}>{item.title}
                </a>}
                description={<Space>
                  {item.date}
                  <div>
                    {item.tags && item.tags.map(f => (
                      <Tag bordered={false} >
                        {f}
                      </Tag>))}
                  </div>
                </Space>}
              />
              {item.brief}
            </List.Item>
          )}
        />
      </Typography>
    </>
  );
}