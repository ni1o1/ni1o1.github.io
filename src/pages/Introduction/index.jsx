import React from 'react'
import { Typography, Divider } from 'antd';
import ReactMarkdown from 'react-markdown'

const { Title, Paragraph, Text, Link } = Typography;

const markdown = `
## Introduction
Dr. Yu Qing is a Postdoctoral Researcher at the School of Urban Planning and Design, Peking University Shenzhen Graduate School. He obtained his Ph.D. in Transportation Engineering from Tongji University. Dr. Yu is the author of two books and has contributed to forty peer-reviewed journal articles. His research focuses on transportation energy and emissions, transportation data science, urban planning, and agent-based simulation.

## Research Interests


- Transportation data science
- Transportation energy and emissions
- Electric vehicles
- Public transportation
- Urban planning & mobility
- Agent-based simulation
`

export default function Introduction() {
  return (
    <Typography>
      <ReactMarkdown children={markdown}  />
    </Typography>
  )
}
