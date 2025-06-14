import React, { useState, useEffect } from 'react';
import { Typography, Divider, Skeleton } from 'antd';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import './index.css';

export default function Publication() {
  const [markdown, setMarkdown] = useState('');
  const { t, i18n } = useTranslation();

  // Function to replace Chinese keywords with translations
  const processMarkdownContent = (content) => {
    if (i18n.language === 'en') {
      // Replace Chinese keywords with English translations
      return content
        .replace(/论著/g, t('论著') || 'Publications')
        .replace(/期刊与会议论文/g, t('期刊与会议论文') || 'Journal Papers')
        .replace(/期刊/g, t('期刊') || 'Journal')
        .replace(/会议论文/g, t('会议论文') || 'Conference Papers')
        .replace(/专著/g, t('专著') || 'Books')
        .replace(/章节/g, t('章节') || 'Book Chapters');
    }
    return content;
  };

  useEffect(() => {
    // Load the markdown content
    import('./content.md')
      .then(res => fetch(res.default)) // Fetch the imported content
      .then(response => response.text()) // Convert response to text
      .then(text => {
        const processedText = processMarkdownContent(text);
        setMarkdown(processedText);
      }); // Set the processed markdown content
  }, [i18n.language]); // Re-run when language changes

  return (
    <div className='markdown-body'>
      <Skeleton loading={markdown === ''} active title>
        <ReactMarkdown children={markdown} />
      </Skeleton>
    </div>
  )
}
