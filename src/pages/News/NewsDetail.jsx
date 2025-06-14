// NewsDetail.js (Refactored)
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Space, Button, Skeleton, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AV from 'leancloud-storage';
import { useTranslation } from 'react-i18next';
import ViewCounter from '../../ViewCounter';
import LikeDislike from '../../LikeDislike';
export default function NewsDetail() {
  const navigate = useNavigate();
  const { filename } = useParams();
  const [content, setContent] = useState('');

  // State to hold the fetched stats for this single article
  const [ratingData, setRatingData] = useState({ likes: 0, dislikes: 0, objectId: null });
  // We don't need state for views here because the ViewCounter's increment logic handles its own fetching


  const { t, i18n } = useTranslation();


  // Effect to fetch the markdown content of the article
  useEffect(() => {
    const loadPostContent = async () => {
      try {
        // Determine the language directory
        const langDir = i18n.language === 'zh' ? 'zh' : 'en';
        
        // Import the specific markdown file
        const postModules = import.meta.glob('/public/posts/**/*.md', { as: 'raw' });
        const postPath = `/public/posts/${langDir}/${filename}.md`;
        
        if (postModules[postPath]) {
          const content = await postModules[postPath]();
          
          // Remove the YAML front matter from content for display
          const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
          const contentWithoutFrontMatter = content.replace(frontMatterRegex, '');
          
          setContent(contentWithoutFrontMatter);
        } else {
          console.error(`Post not found: ${postPath}`);
          setContent("# Article Not Found");
        }
      } catch (err) {
        console.error("Failed to load post content:", err);
        setContent("# Article Not Found");
      }
    };
    
    if (filename) {
      loadPostContent();
    }
  }, [filename, i18n.language]);

  // Effect to fetch the initial Like/Dislike stats for this article
  useEffect(() => {
    if (!filename) return;

    const ratingQuery = new AV.Query('Ratings');
    ratingQuery.equalTo('itemId', filename);

    ratingQuery.first().then(result => {
      if (result) {
        setRatingData({
          likes: result.get('likes') || 0,
          dislikes: result.get('dislikes') || 0,
          objectId: result.id,
        });
      }
      // If no result, the initial state of {0, 0, null} is correct
    }).catch(error => {
      console.error("Failed to fetch rating data:", error);
    });

  }, [filename]); // This runs once when the component mounts with a filename

  return (
    <>
      <Skeleton loading={!content} active paragraph={{ rows: 10 }}>
        <div className='markdown-body' style={{ padding: '24px' }}>
          <Space align="center" style={{ marginBottom: '16px' }}>
            <Button
              size='large'
              shape="circle"
              type='text'
              onClick={() => navigate('/news')}
            >
              <ArrowLeftOutlined />
            </Button>

            {/* ViewCounter's logic for incrementing is self-contained and works correctly.
              No initial prop is needed as it will fetch and set its own state.
            */}
            <ViewCounter itemId={filename} increment={true} />

            {/* Pass the fetched initial data to LikeDislike. 
              This ensures it displays the correct counts on load.
            */}
            <LikeDislike
              itemId={filename}
              initialLikes={ratingData.likes}
              initialDislikes={ratingData.dislikes}
              objectId={ratingData.objectId}
            />
          </Space>
          <ReactMarkdown children={content} />
          <Divider>
            <Space>
            {t("你觉得这项研究怎么样？")}<LikeDislike
            itemId={filename}
            initialLikes={ratingData.likes}
            initialDislikes={ratingData.dislikes}
            objectId={ratingData.objectId}
          /></Space>
          </Divider>

        </div>
      </Skeleton>
    </>
  );
}