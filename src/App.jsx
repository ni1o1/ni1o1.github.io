import React from 'react';
import Mainpage from '@/component/Mainpage';
import './App.css'; // Import your CSS file
import 'antd/dist/antd.css'; // Import Ant Design CSS

import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'


export default function App() {
      return (
            <HashRouter>
                  <Mainpage />
            </HashRouter>

      );
}
