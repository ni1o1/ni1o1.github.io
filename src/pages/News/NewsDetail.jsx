// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Tabs, Button, Skeleton } from 'antd';
import {
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

export default function NewsDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { filename } = useParams();
  const [Content, setContent] = useState('');

  useEffect(() => {
    axios.get(`posts/${filename}_${i18n.language}`).then(res => {
      // Assuming the markdown content is the direct response text
      setContent(res.data || ''); 
    });
  }, [i18n.language]);

  return (
    <>
      <Skeleton loading={Content === ''} active title>
        <div className='markdown-body'>
          <Button
            size='large'
            shape="circle"
            type='text'
            onClick={() => {
              navigate('/news')
            }}><ArrowLeftOutlined /></Button>
          <ReactMarkdown children={Content} />
        </div>
      </Skeleton>
    </>
  );
}