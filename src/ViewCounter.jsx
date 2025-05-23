// src/ViewCounter.jsx (Final, Robust Version)
import React, { useState, useEffect, useRef } from 'react'; // 1. 导入 useRef
import AV from 'leancloud-storage';
import { Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

const ViewCounter = ({ itemId, increment = false }) => {
  const [views, setViews] = useState('...');
  
  // 2. 创建一个 ref 作为“哨兵”，初始值为 false
  // 它会记录“+1”这个动作是否已经执行过
  const hasIncremented = useRef(false);

  useEffect(() => {
    const processViews = async () => {
      if (!itemId) return;

      const query = new AV.Query('Views');
      query.equalTo('itemId', itemId);
      
      try {
        const counter = await query.first();

        // 3. 在执行+1逻辑前，检查“哨兵”
        if (increment && !hasIncremented.current) {
          // 标记为“已执行”，防止后续的重渲染再次触发
          hasIncremented.current = true; 
          
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

        } else {
          // 只读逻辑或已经加过1的情况
          if (counter) {
            setViews(counter.get('views') || 0);
          } else {
            setViews(0);
          }
        }
      } catch (error) {
        console.error('Failed to process views:', error);
        setViews(0);
      }
    };

    processViews();
  }, [itemId, increment]);

  return (
    <Tag icon={<EyeOutlined />} bordered={false}
    style={{
      backgroundColor: '#fff',
      color: 'rgba(0,0,0,0.45)',
    }}
    >
      {views}
    </Tag>
  );
};

export default ViewCounter;