import React from 'react'
import { Typography, Divider } from 'antd';

const { Title, Paragraph, Text, Link } = Typography;

export default function Introduction() {
  return (
    <Typography>
    <Title level={2}>教育背景</Title>
    <Paragraph>    
    <ul>
        <li>
        2018.09-2022.06 同济大学	工学博士	交通运输工程
        </li>
        <li>
        2019.10-2020.03	东京大学	公派联合培养博士	空间信息科学研究中心
        </li>
        <li>
        2015.09-2018.07	同济大学	工学硕士	交通运输工程
        </li>
        <li>
        2011.09-2015.07	广东工业大学	工学学士	交通运输
        </li>
      </ul>
    </Paragraph>
    <Divider/>
    <Title level={2}>研究方向</Title>
    <Paragraph>
    <ul>
        <li>
          交通时空大数据
        </li>
        <li>
          城市计算
        </li>
      </ul>
    </Paragraph>
    </Typography>
  )
}
