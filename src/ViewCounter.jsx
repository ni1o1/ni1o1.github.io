// src/ViewCounter.jsx (Simplified for Batching)
import React, { useState, useEffect, useRef } from 'react';
import AV from 'leancloud-storage';
import { Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

const ViewCounter = ({ itemId, increment = false, views: initialViews = 0 }) => {
  const [views, setViews] = useState(initialViews);
  const hasIncremented = useRef(false);

  // This effect now only runs on the detail page (when increment is true)
  useEffect(() => {
    // Only fetch/increment if in increment mode
    if (increment) {
      const processViews = async () => {
        if (!itemId || hasIncremented.current) return;
        hasIncremented.current = true;

        const query = new AV.Query('Views');
        query.equalTo('itemId', itemId);
        try {
          const counter = await query.first();
          let savedCounter;
          if (counter) {
            counter.increment('views', 1);
            savedCounter = await counter.save(null, { fetchWhenSave: true });
          } else {
            const Views = AV.Object.extend('Views');
            const newCounter = new Views();
            newCounter.set('itemId', itemId);
            newCounter.set('views', 1);
            savedCounter = await newCounter.save();
          }
          setViews(savedCounter.get('views'));
        } catch (error) {
          console.error('Failed to process views:', error);
        }
      };
      processViews();
    } else {
      // For list view, just update the state if the prop changes
      setViews(initialViews);
    }
  }, [itemId, increment, initialViews]);

  return (
    <Tag icon={<EyeOutlined />} bordered={false} style={{ backgroundColor: '#fff', color: 'rgba(0,0,0,0.45)' }}>
      {/* Show initialViews directly unless updated by the effect */}
      {increment ? views : initialViews}
    </Tag>
  );
};

export default ViewCounter;