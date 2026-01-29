import React, { useState, useEffect } from 'react';
import AV from 'leancloud-storage';

const LOCAL_STORAGE_KEY = 'research_ratings';

const LikeDislike = ({ itemId, initialLikes = 0, initialDislikes = 0, objectId }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userAction, setUserAction] = useState(null);
  const [lcObjectId, setLcObjectId] = useState(objectId);

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
      const ratingToUpdate = AV.Object.createWithoutData('Ratings', lcObjectId);
      ratingToUpdate.increment('likes', likesIncrement);
      ratingToUpdate.increment('dislikes', dislikesIncrement);
      ratingToUpdate.save().catch(console.error);
    } else {
      const Ratings = AV.Object.extend('Ratings');
      const newRating = new Ratings();
      newRating.set('itemId', itemId);
      newRating.set('likes', likes + likesIncrement);
      newRating.set('dislikes', dislikes + dislikesIncrement);
      newRating.save().then((savedObj) => {
        setLcObjectId(savedObj.id);
      }).catch(console.error);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={() => handleAction('liked')}
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
      <button
        onClick={() => handleAction('disliked')}
        disabled={userAction === 'disliked'}
        className={`inline-flex items-center gap-1 text-xs bg-transparent border-none cursor-pointer px-1 py-0.5 rounded ${
          userAction === 'disliked' ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-1.302 4.665c-.245.404.028.96.5.96h1.053c.832 0 1.612-.453 1.918-1.227.306-.775.607-1.9.831-3.148a12 12 0 00.521-3.507c0-.503-.032-.999-.095-1.488C21.08 3.694 20.158 3 19.128 3h-3.126c-.618 0-.991.724-.725 1.282A7.471 7.471 0 0016 7.5c0-.69-.093-1.36-.27-1.995a4.498 4.498 0 00-.322-1.672c-.304-.76-.93-1.331-1.653-1.716a9.04 9.04 0 00-2.861-2.4c-.498-.634-1.226-1.08-2.032-1.08H5.904c-.618 0-1.217.247-1.605.729A11.95 11.95 0 001.65 7.888c0 .434.023.863.068 1.285C1.827 10.194 2.746 10.888 3.772 10.888h3.126" />
        </svg>
        {dislikes}
      </button>
    </div>
  );
};

export default LikeDislike;
