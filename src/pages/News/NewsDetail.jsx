// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Space, Button, Skeleton } from 'antd';
import {
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ViewCounter from '../../ViewCounter'; // 假设它和 NewsDetail.jsx 在同一目录下

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
        <Space align="center" style={{ marginBottom: '16px' }}>
            <Button
              size='large'
              shape="circle"
              type='text'
              onClick={() => {
                navigate('/news')
              }}><ArrowLeftOutlined /></Button>
            <ViewCounter itemId={filename} increment={true} />
          </Space>
          <ReactMarkdown children={Content} />
        </div>
      </Skeleton>
    </>
  );
}