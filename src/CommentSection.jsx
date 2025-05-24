// src/CommentSection.jsx
import React, { useState, useEffect } from 'react';
import AV from 'leancloud-storage';
// 从 'antd' 中移除 Comment
import { List, Form, Input, Button, message, Typography, Divider } from 'antd'; 
// 从 '@ant-design/compatible' 中单独导入 Comment
import { Comment } from '@ant-design/compatible';

const { TextArea } = Input;
const { Title } = Typography;

// 评论表单组件
const CommentEditor = ({ onSubmit, submitting }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} onFinish={(values) => onSubmit(values, form)}>
      <Form.Item name="nickname" rules={[{ required: true, message: '请输入你的昵称!' }]}>
        <Input placeholder="昵称" />
      </Form.Item>
      <Form.Item name="content" rules={[{ required: true, message: '请输入评论内容!' }]}>
        <TextArea rows={4} placeholder="说点什么..." />
      </Form.Item>
      <Form.Item>
        <Button htmlType="submit" loading={submitting} type="primary">
          发表评论
        </Button>
      </Form.Item>
    </Form>
  );
};

// 评论区主组件
const CommentSection = ({ itemId }) => {
  const [comments, setComments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // 使用 useEffect 从 LeanCloud 加载评论
  useEffect(() => {
    if (!itemId) return;
    setLoading(true);

    const query = new AV.Query('Comments');
    query.equalTo('itemId', itemId); // 查询与当前文章 ID 匹配的评论
    query.descending('createdAt'); // 按创建时间降序排列（新的在前）
    
    query.find().then((results) => {
      setComments(results);
      setLoading(false);
    }).catch(error => {
      message.error('评论加载失败，请刷新页面重试');
      console.error('Error fetching comments:', error);
      setLoading(false);
    });

  }, [itemId]);

  // 处理评论提交的函数
  const handleSubmit = (values, form) => {
    setSubmitting(true);

    const Comment = AV.Object.extend('Comments');
    const newComment = new Comment();
    newComment.set('nickname', values.nickname);
    newComment.set('content', values.content);
    newComment.set('itemId', itemId); // 关联到当前文章

    newComment.save().then((savedComment) => {
      message.success('评论成功!');
      setSubmitting(false);
      // 将新评论添加到列表最前面，实现即时刷新
      setComments([savedComment, ...comments]);
      form.resetFields(); // 清空表单
    }).catch(error => {
      message.error('评论失败，请重试');
      console.error('Error saving comment:', error);
      setSubmitting(false);
    });
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <Divider orientation="left">评论区</Divider>

      {/* 评论列表 */}
      <List
        className="comment-list"
        header={`${comments.length} 条评论`}
        itemLayout="horizontal"
        dataSource={comments}
        loading={loading}
        renderItem={item => (
          <li>
            <Comment
              author={<a>{item.get('nickname')}</a>}
              content={<p>{item.get('content')}</p>}
              datetime={<span>{item.createdAt.toLocaleString()}</span>}
            />
          </li>
        )}
      />
      <Divider/>
            {/* 评论提交表单 */}
            <CommentEditor onSubmit={handleSubmit} submitting={submitting} />

    </div>
  );
};

export default CommentSection;