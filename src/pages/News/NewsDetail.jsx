// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Tabs, Button } from 'antd';
import {
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { TabPane } = Tabs;
export default function NewsDetail() {

  const navigate = useNavigate();
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

    if (navigator.language === 'zh-CN') {
      setLanguage('cn')
    } else {
      setLanguage('en')
    }
  }, []);


  return (
    <>

      <div className='markdown-body'>
        <Tabs
        tabBarStyle={{ marginBottom: 0 ,
         // backgroundColor: '#f0f2f5'
        }}
          tabBarExtraContent={{
            'left': <Button
              size='large'
              shape="circle"
              type='text'
              onClick={() => {
                navigate('/news')
              }}><ArrowLeftOutlined /></Button>
          }}
          centered
          activeKey={language} size={'small'} 
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