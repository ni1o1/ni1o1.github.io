// NewsDetail.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

export default function NewsDetail() {

  const { filename } = useParams();
  const [Content, setContent] = useState({
  });

  useEffect(() => {
    axios.get(`posts/${filename}`).then(res => {
      setContent(res.data);
    });
  }, [filename]);

  return (
    <>
 
      <div className='markdown-body'>
        <ReactMarkdown children={Content} />
      </div>
    </>
  );
}