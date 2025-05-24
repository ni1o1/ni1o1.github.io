// src/Intro.js (Updated with Batch Fetching)
import React, { useEffect, useState } from 'react';
import { List, Tag, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import AV from 'leancloud-storage';
import ViewCounter from '../../ViewCounter';
import LikeDislike from '../../LikeDislike';



export default function Intro() {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const { t, i18n } = useTranslation();

  // State to hold the fetched data in a map for easy lookup
  const [statsMap, setStatsMap] = useState({
    views: new Map(),
    ratings: new Map(),
  });

  // Effect to fetch the list of news articles
  useEffect(() => {
    axios.get('posts/allposts.json').then(res => {
      const files = res.data;
      const visibleNews = files.posts.filter(f => f.show).sort((a, b) => new Date(b.date) - new Date(a.date));
      setNews(visibleNews);
    });
  }, []);

  // Effect to batch fetch stats AFTER news has been loaded
  useEffect(() => {
    if (news.length === 0) return;

    const itemIds = news.map(item => item.filename);

    const fetchStats = async () => {
      try {
        // 1. Batch fetch all views
        const viewQuery = new AV.Query('Views');
        viewQuery.containedIn('itemId', itemIds);
        const viewResults = await viewQuery.find();
        const newViewsMap = new Map(viewResults.map(item => [item.get('itemId'), item.get('views')]));
        // 2. Batch fetch all ratings (likes/dislikes)
        const ratingQuery = new AV.Query('Ratings');
        ratingQuery.containedIn('itemId', itemIds);
        const ratingResults = await ratingQuery.find();
        const newRatingsMap = new Map(ratingResults.map(item => [item.get('itemId'), {
          likes: item.get('likes') || 0,
          dislikes: item.get('dislikes') || 0,
          objectId: item.id // Pass the objectId for updates
        }]));

        setStatsMap({ views: newViewsMap, ratings: newRatingsMap });

      } catch (error) {
        console.error("Failed to batch fetch stats:", error);
      }
    };

    fetchStats();
  }, [news]); // This effect runs whenever the news array changes

  return (
    <List
      itemLayout="vertical"
      size="large"
      dataSource={news}
      pagination={{ pageSize: 10 }}
      renderItem={(item) => {
        // Get stats for the current item from the map
        const views = statsMap.views.get(item.filename) || 0;
        const ratings = statsMap.ratings.get(item.filename) || { likes: 0, dislikes: 0 };

        return (
          <List.Item key={item.filename}>
            <List.Item.Meta
              title={<a onClick={() => navigate(`/news/${item.filename}`)}>{i18n.language === 'zh' ? item.title : item.title_en}</a>}
              description={
                <Space>

                  <span>{item.date}</span>
                  <ViewCounter views={views} />
                  <LikeDislike
                    itemId={item.filename}
                    initialLikes={ratings.likes}
                    initialDislikes={ratings.dislikes}
                    objectId={ratings.objectId}
                  />
                  <div>
                    {item.tags && item.tags.map((f, tagIndex) => (
                      <Tag key={f} bordered={false} color="blue">
                        {t(f)}
                      </Tag>))}
                  </div>
                </Space>
              }
            />
             {i18n.language == 'zh' ? item.brief : item.brief_en}
          </List.Item>
        );
      }}
    />
  );
}