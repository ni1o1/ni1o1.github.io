import React, { useEffect, useState } from 'react';
import { Typography, Divider, Skeleton, Card } from 'antd';
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next';
/* import Campusmap from '@/component/Campusmap';
 */
export default function Introduction() {
  const [markdown, setMarkdown] = useState('');
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Load the markdown content
    import(`./content_${i18n.language}.md`)
      .then(res => fetch(res.default)) // Fetch the imported content
      .then(response => response.text()) // Convert response to text
      .then(text => setMarkdown(text)); // Set the markdown content
  }, [i18n.language]);


const height = 500;

  return (

    <div className='markdown-body'>
      <Skeleton loading={markdown == ''} active title>
        <ReactMarkdown children={markdown} />
        {/* <div style={{  height,margin:50 }}>
          <Card>
            <div style={{height:height-100}}>
            <Campusmap />
            </div>
          </Card>
        </div> */}
      </Skeleton>
    </div>
  )
}
