import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "./i18n/config";
import AV from 'leancloud-storage'; // 引入 SDK

AV.init({
  appId: import.meta.env.VITE_LEANCLOUD_APP_ID,
  appKey: import.meta.env.VITE_LEANCLOUD_APP_KEY,
  // 如果你的应用是在 LeanCloud 华北节点，需要配置 serverURL
  // serverURL: "https://xxx.avosapps.us" 
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
