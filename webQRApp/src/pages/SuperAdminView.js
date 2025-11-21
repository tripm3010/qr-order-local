import React, { useState, useEffect } from 'react';

// Helper lấy URL API tự động
const getApiBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    
    // 1. Nếu chạy Localhost (npm start port 3000)
    if (port === '3000') {
        return `${protocol}//${hostname}:8080/api`;
    }
    
    // 2. Nếu chạy Production (Docker/Nginx/HTTPS)
    // Trả về đường dẫn tương đối. Trình duyệt sẽ tự thêm https://domain.com vào trước
    return '/api';
};

let apiClient;

export default function SuperAdminView() {
  const [token, setToken] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('admin');
  const [newAdminPass, setNewAdminPass] = useState('123456');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // === 1. LOGIN ===
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // [SỬA LỖI HTTPS] Dùng hàm helper thay vì gán cứng
    const baseURL = getApiBaseUrl();
    const client = window.axios.create({ baseURL });
    
    try {
      const res = await client.post('/auth/login', { username, password });
      const jwt = res.data.jwt;
      
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      if (payload.role !== 'ROLE_SUPER_ADMIN') {
          alert("Bạn không phải chủ hệ thống!");
          return;
      }

      setToken(jwt);
      apiClient = window.axios.create({
          baseURL,
          headers: { 'Authorization': `Bearer ${jwt}` }
      });
      fetchStores();
    } catch (err) {
      console.error(err);
      alert("Đăng nhập thất bại");
    }
  };

  // === 2. FETCH DATA ===
  const fetchStores = async () => {
      if(!apiClient) return;
      try {
        const res = await apiClient.get('/super-admin/stores');
        setStores(res.data);
      } catch(e) { console.error(e); }
  };

  // === 3. CREATE STORE ===
  const handleCreateStore = async (e) => {
      e.preventDefault();
      try {
          await apiClient.post('/super-admin/stores', {
              storeName: newStoreName,
              subdomain: newSubdomain,
              adminUsername: newAdminUser,
              adminPassword: newAdminPass
          });
          alert("Tạo cửa hàng thành công!");
          setIsModalOpen(false);
          fetchStores();
          setNewSubdomain(''); setNewStoreName('');
      } catch (err) {
          alert("Lỗi: " + (err.response?.data || "Không thể tạo"));
      }
  }

  const getStoreLink = (sub) => {
      // Tạo link động dựa trên protocol hiện tại (http hoặc https)
      const { protocol, host } = window.location;
      const parts = host.split('.');
      
      if (host.includes('localhost')) {
          return `http://${sub}.localhost:3000/admin`;
      }
      
      if (parts.length >= 3) {
          const baseDomain = parts.slice(1).join('.'); 
          return `${protocol}//${sub}.${baseDomain}/admin`;
      }
      return '#';
  };

  if (!token) {
      return (
          <div className="flex items-center justify-center h-screen bg-gray-900">
              <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                  <h1 className="text-2xl font-bold mb-6 text-center">QUẢN LÝ HỆ THỐNG (SaaS)</h1>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <input className="w-full border p-2 rounded" placeholder="Username (boss)" value={username} onChange={e=>setUsername(e.target.value)} />
                    <input className="w-full border p-2 rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Đăng nhập</button>
                  </form>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Danh sách Cửa hàng</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-green-700">+ Đăng ký Cửa hàng mới</button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-800 text-white">
                        <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">Tên Cửa hàng</th>
                            <th className="p-4">Đường dẫn quản trị</th>
                            <th className="p-4">Admin</th>
                            <th className="p-4">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stores.map(store => (
                            <tr key={store.id} className="border-b hover:bg-gray-50">
                                <td className="p-4">{store.id}</td>
                                <td className="p-4 font-bold text-lg">{store.name}</td>
                                <td className="p-4">
                                    <a href={getStoreLink(store.subdomain)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                                        {getStoreLink(store.subdomain)}
                                    </a>
                                </td>
                                <td className="p-4 text-gray-600">admin / 123456</td>
                                <td className="p-4"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Active</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Đăng ký Cửa hàng mới</h2>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                    </div>
                    <form onSubmit={handleCreateStore} className="space-y-3">
                        <div>
                            <label className="block text-sm font-bold mb-1">Tên Cửa hàng</label>
                            <input value={newStoreName} onChange={e=>setNewStoreName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: Phở Cồ" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Subdomain (Duy nhất)</label>
                            <div className="flex items-center border rounded bg-gray-50">
                                <input value={newSubdomain} onChange={e=>setNewSubdomain(e.target.value)} className="flex-1 p-2 bg-transparent outline-none" placeholder="pho-co" required />
                                <span className="text-gray-500 text-xs pr-2 font-mono">.qranza...</span>
                            </div>
                        </div>
                        <hr className="my-2" />
                        <div>
                            <label className="block text-sm font-bold mb-1">Tài khoản Admin</label>
                            <input value={newAdminUser} onChange={e=>setNewAdminUser(e.target.value)} className="w-full border p-2 rounded bg-gray-100" readOnly />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Mật khẩu khởi tạo</label>
                            <input value={newAdminPass} onChange={e=>setNewAdminPass(e.target.value)} className="w-full border p-2 rounded bg-gray-100" readOnly />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Hủy</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Tạo ngay</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
}
