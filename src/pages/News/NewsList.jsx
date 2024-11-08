// Introduction.js
import React, { useEffect, useState } from 'react';
import { Typography, List, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import matter from 'front-matter';
import axios from 'axios';
export default function Intro() {

  const navigate = useNavigate();
  const [news, setNews] = useState([]);


  useEffect(() => {
    let newsList = [];
    axios.get('posts/allposts.json').then(res => {
      const files = res.data;
      files.posts.map((filename) => {

        axios.get(`posts/${filename}`).then(res => {

          const fileContent = res.data;
          console.log(fileContent)
          const parsedContent = matter(fileContent);
          console.log(parsedContent)

          newsList = [...newsList, {
            filename: filename.replace('./', ''), // 格式化文件名以便在路由中使用
            data: parsedContent.attributes,
            content: parsedContent.body,
          }]
          setNews(newsList.sort((a, b) => new Date(b.data.date) - new Date(a.data.date)));
        })
      })
    })
  }
    , []);
  console.log(news)
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