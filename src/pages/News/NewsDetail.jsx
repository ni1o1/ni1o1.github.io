// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Tabs } from 'antd';
import axios from 'axios';

const { TabPane } = Tabs;
export default function NewsDetail() {

  const { filename } = useParams();
  const [Content, setContent] = useState({
  });
  const [Content_en, setContent_en] = useState({
  });
  useEffect(() => {
    axios.get(`posts/${filename}`).then(res => {
      setContent(res.data);
    });
    axios.get(`posts/${filename}_en`).then(res => {
      setContent_en(res.data);
    });
  }, [filename]);




  const [language, setLanguage] = useState('');
 
  useEffect(() => {

    console.log(navigator.language)
    if (navigator.language === 'zh-CN') {
      setLanguage('cn')
    } else {
      setLanguage('en')
    }
  }, []);


  return (
    <>

      <div className='markdown-body'>
        <Tabs activeKey={language} size={'small'}  centered
          onTabClick={(key) => {
            setLanguage(key)
          }}
        >
          <TabPane tab="中文" key="cn">
            <ReactMarkdown children={Content} />
          </TabPane>
          <TabPane tab="English" key="en">
            <ReactMarkdown children={Content_en} />
          </TabPane>
        </Tabs>
      </div>
    </>
  );
}