// Introduction.js
import React, { useEffect, useState } from 'react';
import { Typography,  List, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import matter from 'front-matter';
export default function Intro() {

  const navigate = useNavigate();
  const [news, setNews] = useState([]);


  useEffect(() => {
    const fetchNews = async () => {
      const files = require.context('./', false, /\.md$/);

      const newsList = await Promise.all(
        files.keys().map(async (filename) => {
          const fileContent = await import(`./${filename.replace('./', '')}`)
            .then((res) => fetch(res.default)) // Fetch the imported content
            .then((response) => response.text());

          const parsedContent = matter(fileContent);
          return {
            filename: filename.replace('./', ''), // 格式化文件名以便在路由中使用
            data: parsedContent.attributes,
            content: parsedContent.body,
          };
        })
      );

      const sortedNewsList = newsList.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
      setNews(sortedNewsList);
    };

    fetchNews();
  }, []);

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
                }}>{item.data.title}
                </a>}
                description={<>
                  {item.data.tags && item.data.tags.map(f => (
                    <Tag bordered={false} >
                      {f}
                    </Tag>))}
                  {item.data.brief}
                </>}
              />
              {item.data.date}
            </List.Item>
          )}
        />
      </Typography>
    </>
  );
}