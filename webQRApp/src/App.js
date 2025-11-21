import React from 'react';
import { Routes, Route } from 'react-router-dom';

// [SỬA LỖI] Thêm lại đường dẫn './pages/'
import CustomerView from './pages/CustomerView.js';
import KitchenView from './pages/KitchenView.js';
import StaffView from './pages/StaffView.js';
// [MỚI] Import màn hình Admin
import AdminView from './pages/AdminView.js';
import SuperAdminView from './pages/SuperAdminView.js';


/**
 * Đây là file App.js chính.
 * Nó điều khiển router
 * để hiển thị đúng màn hình dựa trên URL.
 */
export default function App() {
  return (
    <Routes>
      {/* Route Khách hàng */}
      <Route path="/" element={<CustomerView />} />

      {/* Route Bếp */}
      <Route path="/kitchen" element={<KitchenView />} />

      {/* Route Nhân viên */}
      <Route path="/staff" element={<StaffView />} />
      
      {/* [MỚI] Route Quản lý */}
      <Route path="/admin" element={<AdminView />} />

      {/* [MỚI] Route Quản lý Store */}
      <Route path="/super-admin" element={<SuperAdminView />} />
    </Routes>
  );
}