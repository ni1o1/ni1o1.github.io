import React, { useState, useEffect, useRef } from 'react';
import AV from 'leancloud-storage';

const ViewCounter = ({ itemId, increment = false, views: initialViews = 0 }) => {
  const [views, setViews] = useState(initialViews);
  const hasIncremented = useRef(false);

  useEffect(() => {
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
            savedCounter = await counter.save(null, { fetchWhenState: true });
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
      setViews(initialViews);
    }
  }, [itemId, increment, initialViews]);

  return (
    <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {increment ? views : initialViews}
    </span>
  );
};

export default ViewCounter;
