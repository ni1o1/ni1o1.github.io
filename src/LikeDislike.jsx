// src/LikeDislike.jsx (Simplified for Batching)
import React, { useState, useEffect } from 'react';
import AV from 'leancloud-storage';
import { Button } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';

const LOCAL_STORAGE_KEY = 'research_ratings';

const LikeDislike = ({ itemId, initialLikes = 0, initialDislikes = 0, objectId }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userAction, setUserAction] = useState(null);
  const [lcObjectId, setLcObjectId] = useState(objectId); // Keep track of the LeanCloud object ID

  // This effect only runs once to set initial state from props and localStorage
  useEffect(() => {
    setLikes(initialLikes);
    setDislikes(initialDislikes);
    setLcObjectId(objectId);
    
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    if (userRatings[itemId]) {
      setUserAction(userRatings[itemId]);
    }
  }, [initialLikes, initialDislikes, objectId, itemId]);

  const updateUserRatingLocally = (action) => {
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    userRatings[itemId] = action;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userRatings));
    setUserAction(action);
  };

  const handleAction = async (actionType) => {
    if (userAction === actionType) return;

    let likesIncrement = (actionType === 'liked') ? 1 : (userAction === 'liked' ? -1 : 0);
    let dislikesIncrement = (actionType === 'disliked') ? 1 : (userAction === 'disliked' ? -1 : 0);

    setLikes(likes + likesIncrement);
    setDislikes(dislikes + dislikesIncrement);
    updateUserRatingLocally(actionType);

    if (lcObjectId) {
      // If the object exists, update it
      const ratingToUpdate = AV.Object.createWithoutData('Ratings', lcObjectId);
      ratingToUpdate.increment('likes', likesIncrement);
      ratingToUpdate.increment('dislikes', dislikesIncrement);
      ratingToUpdate.save().catch(console.error);
    } else {
      // If it doesn't exist, create it
      const Ratings = AV.Object.extend('Ratings');
      const newRating = new Ratings();
      newRating.set('itemId', itemId);
      newRating.set('likes', likes + likesIncrement);
      newRating.set('dislikes', dislikes + dislikesIncrement);
      newRating.save().then((savedObj) => {
        setLcObjectId(savedObj.id); // Save the new objectId for future clicks
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
        style={{ color: userAction === 'liked' ? '#1890ff' : 'rgba(0, 0, 0, 0.45)' }}
      >
        {likes}
      </Button>
      <Button
        type="text"
        icon={<DislikeOutlined />}
        onClick={() => handleAction('disliked')}
        disabled={userAction === 'disliked'}
        style={{ color: userAction === 'disliked' ? '#ff4d4f' : 'rgba(0, 0, 0, 0.45)' }}
      >
        {dislikes}
      </Button>
    </div>
  );
};

export default LikeDislike;