import React from 'react';
import ReactDOM from 'react-dom/client';
// [MỚI] Import BrowserRouter
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App'; // Đây là file App.js (Router)

// [SỬA LỖI RACE CONDITION]
// (Giữ nguyên logic window.onload)
window.onload = () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      {/* [MỚI] Bọc App trong BrowserRouter */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
};