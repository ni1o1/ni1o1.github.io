import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const LOCAL_STORAGE_KEY = 'research_ratings';

const LikeDislike = ({ itemId, initialLikes = 0 }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [userAction, setUserAction] = useState(null);

  useEffect(() => {
    setLikes(initialLikes);
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    if (userRatings[itemId]) {
      setUserAction(userRatings[itemId]);
    }
  }, [initialLikes, itemId]);

  const updateUserRatingLocally = (action) => {
    const userRatings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    userRatings[itemId] = action;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userRatings));
    setUserAction(action);
  };

  const handleLike = async () => {
    if (userAction === 'liked') return;

    setLikes(likes + 1);
    updateUserRatingLocally('liked');

    try {
      await fetch(`${API_BASE}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'like' })
      });
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={userAction === 'liked'}
      className={`inline-flex items-center gap-1 text-xs bg-transparent border-none cursor-pointer px-1 py-0.5 rounded ${
        userAction === 'liked' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
      </svg>
      {likes}
    </button>
  );
};

export default LikeDislike;
