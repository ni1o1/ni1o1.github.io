// Introduction.js
import React, { useEffect, useState } from 'react';
import { Typography, List, Tag, Space, Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
export default function Intro() {

  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const { t,i18n } = useTranslation();

  useEffect(() => {
    axios.get('posts/allposts.json').then(res => {
      const files = res.data;
      setNews(files.posts.filter(f=>f.show).sort((a, b) => new Date(b.date) - new Date(a.date)));
    })
  }, [])

  return (
    <>
      <Skeleton loading={news.length == 0} active title>
        <Typography>
          <List
            itemLayout="vertical"
            size="large"
            dataSource={news}
            pagination={{
              pageSize: 10,
            }}
            renderItem={(item, index) => (
              <List.Item key={item.filename}>
                <List.Item.Meta
                  title={<a onClick={() => {
                    navigate(`/news/${item.filename}`)
                  }}>{i18n.language=='zh'?item.title:item.title_en}
                  </a>}
                  description={<Space>
                    {item.date}
                    <div>
                      {item.tags && item.tags.map((f, tagIndex) => (
                        <Tag key={f} bordered={false} >
                          {t(f)}
                        </Tag>))}
                    </div>
                  </Space>}
                />
                {i18n.language=='zh'?item.brief:item.brief_en}
              </List.Item>
            )}
          />
        </Typography>
      </Skeleton>
    </>
  );
}