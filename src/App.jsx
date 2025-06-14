import React from 'react';
import Mainpage from './component/Mainpage';
import './App.css'; // Import your CSS file

import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'


export default function App() {
      return (
            <BrowserRouter>
                  <Mainpage />
            </BrowserRouter>

      );
}
