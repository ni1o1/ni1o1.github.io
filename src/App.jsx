import React from 'react';
import Mainpage from './component/Mainpage';
import './App.css'; // Import your CSS file

import { HashRouter } from 'react-router-dom'


export default function App() {
      return (
            <HashRouter>
                  <Mainpage />
            </HashRouter>

      );
}
