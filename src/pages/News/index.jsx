import React, { useState } from 'react';
import {  Divider, Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import NewsList from './NewsList';


export default function News() {
  const [news, setNews] = useState([]);



  return (
    <>
      
      <NewsList />

    </>
  )
}
