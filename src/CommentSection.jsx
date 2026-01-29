import React, { useState, useEffect } from 'react';
import AV from 'leancloud-storage';

const CommentSection = ({ itemId }) => {
  const [comments, setComments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    const query = new AV.Query('Comments');
    query.equalTo('itemId', itemId);
    query.descending('createdAt');
    query.find().then((results) => {
      setComments(results);
      setLoading(false);
    }).catch(error => {
      console.error('Error fetching comments:', error);
      setLoading(false);
    });
  }, [itemId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nickname.trim() || !content.trim()) return;
    setSubmitting(true);

    const CommentObj = AV.Object.extend('Comments');
    const newComment = new CommentObj();
    newComment.set('nickname', nickname);
    newComment.set('content', content);
    newComment.set('itemId', itemId);

    newComment.save().then((savedComment) => {
      setSubmitting(false);
      setComments([savedComment, ...comments]);
      setNickname('');
      setContent('');
    }).catch(error => {
      console.error('Error saving comment:', error);
      setSubmitting(false);
    });
  };

  return (
    <div className="mt-10">
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          {comments.length} 条评论
        </h3>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((item, idx) => (
              <div key={idx} className="text-sm">
                <span className="font-medium text-slate-700">{item.get('nickname')}</span>
                <span className="text-xs text-gray-400 ml-2">{item.createdAt.toLocaleString()}</span>
                <p className="text-gray-600 mt-1">{item.get('content')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="昵称"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="说点什么..."
          rows={4}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50 cursor-pointer border-none"
        >
          {submitting ? '提交中...' : '发表评论'}
        </button>
      </form>
    </div>
  );
};

export default CommentSection;
