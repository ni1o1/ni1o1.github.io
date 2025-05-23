import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "./i18n/config";
import AV from 'leancloud-storage'; // 引入 SDK

AV.init({
  appId: 'amedzaVzVk35g8VnDIs1UglE-MdYXbMMI',
  appKey: 'wOeMqRRip6g2uukFbScvjJ5V',
  // 如果你的应用是在 LeanCloud 华北节点，需要配置 serverURL
  // serverURL: "https://xxx.avosapps.us" 
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
