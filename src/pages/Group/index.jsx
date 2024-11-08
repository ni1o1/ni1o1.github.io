import React, { useEffect, useState } from 'react';
import { Typography, Divider } from 'antd';
import ReactMarkdown from 'react-markdown'


export default function Introduction() {
  const [markdown, setMarkdown] = useState('');
  useEffect(() => {
    // Load the markdown content
    import('./content.md')
      .then(res => fetch(res.default)) // Fetch the imported content
      .then(response => response.text()) // Convert response to text
      .then(text => setMarkdown(text)); // Set the markdown content
  }, []);
  return (
    <div className='markdown-body'>
    <ReactMarkdown children={markdown} />
  </div>
  )
}
