// src/LikeDislike.jsx

import React, { useState, useEffect } from 'react';
import AV from 'leancloud-storage';
import { Button } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';

// 定义本地存储的 Key
const LOCAL_STORAGE_KEY = 'research_ratings';

// props: { itemId } - 接收一个唯一标识符，用于区分是哪个研究条目
const LikeDislike = ({ itemId }) => {
  // state
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userAction, setUserAction] = useState(null); // 'liked', 'disliked', or null
  const [leanCloudObject, setLeanCloudObject] = useState(null); // 存储从 LeanCloud 获取的对象

  // useEffect: 组件加载时，获取数据并检查用户本地状态
  useEffect(() => {
    // 1. 从 LeanCloud 获取点赞/点踩数
    const query = new AV.Query('Ratings');
    query.equalTo('itemId', itemId);
    query.first().then((obj) => {
      if (obj) {
        // 如果云端有记录，更新 state
        setLikes(obj.get('likes') || 0);
        setDislikes(obj.get('dislikes') || 0);
        setLeanCloudObject(obj);
      }
      // 如果云端没有记录，默认就是 0，不需要额外操作
    }).catch(console.error);

    // 2. 从 localStorage 检查用户是否已经对该条目操作过
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    if (userRatings[itemId]) {
      setUserAction(userRatings[itemId]);
    }
  }, [itemId]); // 当 itemId 变化时重新执行

  // 更新本地存储
  const updateUserRatingLocally = (action) => {
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    userRatings[itemId] = action;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userRatings));
    setUserAction(action);
  };

  // 核心函数：处理点击事件
  const handleAction = async (actionType) => {
    if (userAction === actionType) return; // 如果已经点了赞，再点赞则不反应

    let likesIncrement = 0;
    let dislikesIncrement = 0;

    // 计算增量
    if (actionType === 'liked') {
      likesIncrement = 1;
      if (userAction === 'disliked') dislikesIncrement = -1; // 从踩变为赞
    } else if (actionType === 'disliked') {
      dislikesIncrement = 1;
      if (userAction === 'liked') likesIncrement = -1; // 从赞变为踩
    }

    // 更新 UI 状态（立即反馈）
    setLikes(likes + likesIncrement);
    setDislikes(dislikes + dislikesIncrement);
    updateUserRatingLocally(actionType);

    // 更新 LeanCloud 后端
    if (leanCloudObject) {
      // 如果对象已存在，直接更新
      leanCloudObject.increment('likes', likesIncrement);
      leanCloudObject.increment('dislikes', dislikesIncrement);
      leanCloudObject.save().catch(console.error);
    } else {
      // 如果对象不存在，创建新对象
      const Ratings = AV.Object.extend('Ratings');
      const newRating = new Ratings();
      newRating.set('itemId', itemId);
      newRating.set('likes', likes); // 使用已经更新过的 state
      newRating.set('dislikes', dislikes);
      // 设置增量，确保数据一致性
      newRating.increment('likes', likesIncrement);
      newRating.increment('dislikes', dislikesIncrement);
      newRating.save().then((savedObj) => {
        setLeanCloudObject(savedObj); // 保存新创建的对象以备后续操作
      }).catch(console.error);
    }
  };

  return (
    <div className="ratings-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Button
        type="text"
        icon={<LikeOutlined />}
        onClick={() => handleAction('liked')}
        disabled={userAction === 'liked'}
        style={{ color: userAction === 'liked' ? '#1890ff' : 'rgba(0, 0, 0, 0.88)' }} // Ant Design primary color or default text color
      >
        {likes}
      </Button>
      <Button
        type="text"
        icon={<DislikeOutlined />}
        onClick={() => handleAction('disliked')}
        disabled={userAction === 'disliked'}
        style={{ color: userAction === 'disliked' ? '#ff4d4f' : 'rgba(0, 0, 0, 0.88)' }} // Ant Design error color or default text color
      >
        {dislikes}
      </Button>
    </div>
  );
};

export default LikeDislike;