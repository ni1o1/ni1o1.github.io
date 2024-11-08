// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HomeOutlined, UserOutlined } from '@ant-design/icons';
import {  Breadcrumb,Divider } from 'antd';

import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
//import matter from 'front-matter';

export default function NewsDetail() {
  const yamlFront = require('yaml-front-matter');


  const navigate = useNavigate();
  const { filename } = useParams();
  const [Content, setContent] = useState({
    attributes: {
      title: '',
      date: '',
      brief: '',
    },
    body: '',
  });

  useEffect(() => {
    const fetchMarkdown = async () => {
      const response = await fetch(`posts/${filename}`)
      const fileContent = await response.text();
      const parsedContent = yamlFront.loadFront(fileContent);
      //const parsedContent = matter(fileContent);
      setContent(parsedContent);
    };

    fetchMarkdown();
  }, [filename]);
console.log(Content)
  return (
    <>
       <Breadcrumb>
        <Breadcrumb.Item onClick={()=>{
          navigate('/news')
        }}>
          <a>
          <HomeOutlined />
          
          </a>
        </Breadcrumb.Item>
        <Breadcrumb.Item >
          {Content.title}
        </Breadcrumb.Item>
      </Breadcrumb>
      <Divider></Divider>
      <div className='markdown-body'>
      <ReactMarkdown children={Content.__content}  />
      </div>
    </>
  );
}