import React, { useState, useEffect } from 'react';

// Giả định các thư viện (axios, sockjs, stomp) có sẵn trên window
let apiClient; 

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

// Helper lấy URL API tự động (Hỗ trợ cả Local & Production HTTPS)
const getApiBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    // 1. Dev mode (npm start port 3000) -> Gọi về 8080
    if (port === '3000') {
        return `${protocol}//${hostname}:8080/api`;
    }
    // 2. Production (Docker/Nginx port 80/443) -> Gọi relative path
    return '/api';
};

export default function AdminView() {
  const [token, setToken] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [subdomain, setSubdomain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentTab, setCurrentTab] = useState('menu'); 
  
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);

  // States cho Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); 
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [qrModalTable, setQrModalTable] = useState(null);
  
  // State cho Mobile Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // === 1. ĐĂNG NHẬP ===
  const handleLogin = async (username, password) => {
    if (!window.axios) { setError("Lỗi: Thư viện Axios chưa tải."); return; }
    
    const baseURL = getApiBaseUrl();
    const loginApiClient = window.axios.create({ baseURL });

    try {
      setLoading(true);
      const response = await loginApiClient.post('/auth/login', { username, password });
      const jwt = response.data.jwt;
      const sub = response.data.subdomain;
      
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      if (!payload.role || !payload.role.includes('ROLE_ADMIN')) {
          setError("Tài khoản không có quyền Admin."); setLoading(false); return;
      }
      setToken(jwt); setStoreId(payload.storeId); setSubdomain(sub);

      apiClient = window.axios.create({
        baseURL,
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      setError(null);
    } catch (err) { setError("Đăng nhập thất bại."); } finally { setLoading(false); }
  };

  // === 2. TẢI DỮ LIỆU ===
  const fetchData = async () => {
    if (!apiClient) return;
    setLoading(true);
    try {
      const [usersRes, tablesRes, catRes, itemsRes, settingsRes] = await Promise.all([
        apiClient.get('/admin/users'),
        apiClient.get('/admin/tables'),
        apiClient.get('/admin/categories'),
        apiClient.get('/admin/menu-items'),
        apiClient.get('/admin/store/settings')
      ]);
      setUsers(usersRes.data); setTables(tablesRes.data);
      setCategories(catRes.data); setMenuItems(itemsRes.data);
      setStoreSettings(settingsRes.data);
      setError(null);
    } catch (err) { setError("Lỗi tải dữ liệu."); } finally { setLoading(false); }
  };

  useEffect(() => { if (token && apiClient) fetchData(); }, [token]);

  // === 3. XỬ LÝ CRUD ===
  const handleCreateCategory = async () => {
    const name = prompt("Tên danh mục mới:");
    if (name) { try { await apiClient.post('/admin/categories', { name }); fetchData(); } catch(e) { alert("Lỗi tạo danh mục."); } }
  };
  const handleDeleteCategory = async (id) => {
    if (window.confirm("Xóa danh mục này?")) { try { await apiClient.delete(`/admin/categories/${id}`); fetchData(); } catch(e) { alert("Lỗi xóa danh mục."); } }
  };

  const handleSaveUser = async (userData) => {
    try { if(userData.id) await apiClient.put(`/admin/users/${userData.id}`, userData); else await apiClient.post('/admin/users', userData); fetchData(); setIsUserModalOpen(false); } catch(e) { alert("Lỗi lưu user."); }
  };
  const handleDeleteUser = async (id) => { if(window.confirm("Xóa user?")) { await apiClient.delete(`/admin/users/${id}`); fetchData(); }};

  const handleSaveTable = async (data) => {
    try { if(data.id) await apiClient.put(`/admin/tables/${data.id}`, data); else await apiClient.post('/admin/tables', data); fetchData(); setIsTableModalOpen(false); } catch(e) { alert("Lỗi lưu bàn."); }
  };
  const handleDeleteTable = async (id) => { if(window.confirm("Xóa bàn?")) { await apiClient.delete(`/admin/tables/${id}`); fetchData(); }};

  const handleSaveMenuItem = async (data, file) => {
    setLoading(true);
    try {
        let url = data.imageUrl;
        if (file) {
            const formData = new FormData(); formData.append("file", file);
            const res = await apiClient.post('/admin/upload', formData, { headers: {'Content-Type': 'multipart/form-data'} });
            url = res.data.url;
        }
        const finalData = { ...data, imageUrl: url };
        if(data.id) await apiClient.put(`/admin/menu-items/${data.id}`, finalData);
        else await apiClient.post('/admin/menu-items', finalData);
        fetchData(); setIsMenuItemModalOpen(false);
    } catch(e) { alert("Lỗi lưu món."); } finally { setLoading(false); }
  };
  const handleDeleteMenuItem = async (id) => { if(window.confirm("Xóa món?")) { await apiClient.delete(`/admin/menu-items/${id}`); fetchData(); }};
  const handleToggleStock = async (id) => { try { await apiClient.put(`/admin/menu-items/${id}/toggle-stock`); fetchData(); } catch(e) { alert("Lỗi cập nhật trạng thái."); } };
  
  const handleSaveSettings = async (settings) => { try { await apiClient.put('/admin/store/settings', settings); alert("Cập nhật thành công!"); fetchData(); } catch (e) { alert("Lỗi cập nhật."); } };


  // === RENDER ===
  if (!token) return <LoginView onLogin={handleLogin} loading={loading} error={error} />;

  return (
    <div className="font-sans antialiased bg-gray-100 min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md z-20 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded hover:bg-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg md:text-2xl font-bold truncate">Quản lý ({subdomain})</h1>
        </div>
        <button onClick={() => setToken(null)} className="text-sm bg-red-600 px-3 py-1 rounded hover:bg-red-700">Đăng xuất</button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out bg-white w-64 z-30 shadow-xl md:shadow-none border-r flex flex-col`}>
           <div className="p-4 border-b md:hidden flex justify-between items-center bg-gray-50"><span className="font-bold text-gray-700">Menu</span><button onClick={() => setIsMobileMenuOpen(false)} className="p-2">✕</button></div>
           <nav className="p-4 space-y-2 flex-1">
             <AdminTabButton tabName="menu" currentTab={currentTab} onClick={(t) => {setCurrentTab(t); setIsMobileMenuOpen(false);}}>🍽️ Thực đơn</AdminTabButton>
             <AdminTabButton tabName="tables" currentTab={currentTab} onClick={(t) => {setCurrentTab(t); setIsMobileMenuOpen(false);}}>🪑 Bàn & QR</AdminTabButton>
             <AdminTabButton tabName="users" currentTab={currentTab} onClick={(t) => {setCurrentTab(t); setIsMobileMenuOpen(false);}}>👥 Nhân viên</AdminTabButton>
             <AdminTabButton tabName="settings" currentTab={currentTab} onClick={(t) => {setCurrentTab(t); setIsMobileMenuOpen(false);}}>⚙️ Cấu hình</AdminTabButton>
           </nav>
        </div>

        {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

        <main className="flex-1 p-4 overflow-y-auto w-full">
          {loading && <p className="text-center py-2 text-blue-600 font-bold text-sm animate-pulse">Đang xử lý...</p>}
          
          <div className={currentTab === 'menu' ? '' : 'hidden'}>
            <MenuManagementView 
              categories={categories} menuItems={menuItems} 
              onCreateCategory={handleCreateCategory} onDeleteCategory={handleDeleteCategory}
              onAddMenuItem={() => {setEditingMenuItem(null); setIsMenuItemModalOpen(true)}}
              onEditMenuItem={(item) => {setEditingMenuItem(item); setIsMenuItemModalOpen(true)}}
              onDeleteMenuItem={handleDeleteMenuItem} onToggleStock={handleToggleStock} 
            />
          </div>
          <div className={currentTab === 'tables' ? '' : 'hidden'}>
            <TableManagementView 
              tables={tables} 
              onAddTable={() => {setEditingTable(null); setIsTableModalOpen(true)}}
              onEditTable={(t) => {setEditingTable(t); setIsTableModalOpen(true)}}
              onDeleteTable={handleDeleteTable}
              onShowQr={setQrModalTable}
            />
          </div>
          <div className={currentTab === 'users' ? '' : 'hidden'}>
            <UserManagementView users={users} onAddUser={() => {setEditingUser(null); setIsUserModalOpen(true)}} onEditUser={(u) => {setEditingUser(u); setIsUserModalOpen(true)}} onDeleteUser={handleDeleteUser} />
          </div>
          <div className={currentTab === 'settings' ? '' : 'hidden'}>
             <StoreSettingsView settings={storeSettings} onSave={handleSaveSettings} />
          </div>
        </main>
      </div>
      
      {isUserModalOpen && <UserEditModal user={editingUser} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} />}
      {isTableModalOpen && <TableEditModal table={editingTable} onClose={() => setIsTableModalOpen(false)} onSave={handleSaveTable} />}
      {isMenuItemModalOpen && <MenuItemEditModal menuItem={editingMenuItem} categories={categories} onClose={() => setIsMenuItemModalOpen(false)} onSave={handleSaveMenuItem} />}
      {qrModalTable && <QrCodeModal table={qrModalTable} onClose={() => setQrModalTable(null)} />}
    </div>
  );
}

// --- CÁC COMPONENT CON ---

function AdminTabButton({ tabName, currentTab, onClick, children }) {
  return <button onClick={() => onClick(tabName)} className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition ${tabName === currentTab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>{children}</button>;
}

function MenuManagementView({ categories, menuItems, onCreateCategory, onDeleteCategory, onAddMenuItem, onEditMenuItem, onDeleteMenuItem, onToggleStock }) {
  // Hàm hiển thị ảnh động (fix lỗi ảnh local khi chạy server thật)
  const getImageUrl = (url) => {
    if (!url) return 'https://placehold.co/100x100/EEE/CCC?text=No+Img';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Ghép host hiện tại của trình duyệt vào link tương đối
    return window.location.origin + url;
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">Danh mục</h3><button onClick={onCreateCategory} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition">+ Thêm Danh mục</button></div>
        <div className="flex flex-wrap gap-3">
            {categories.map(cat => (<div key={cat.id} className="bg-gray-50 px-4 py-2 rounded-full border flex items-center gap-3 group hover:border-blue-200 transition"><span className="font-medium text-gray-700">{cat.name}</span><button onClick={() => onDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-600 font-bold text-lg leading-none">×</button></div>))}
            {categories.length === 0 && <p className="text-gray-400 text-sm italic">Chưa có danh mục nào.</p>}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">Món ăn</h3><button onClick={onAddMenuItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow transition">+ Thêm Món mới</button></div>
         <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]"> 
             <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold"><tr><th className="px-4 py-3 rounded-l-lg w-20">Ảnh</th><th className="px-4 py-3">Tên Món</th><th className="px-4 py-3">Danh mục</th><th className="px-4 py-3">Giá</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right rounded-r-lg">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {menuItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3"><img src={getImageUrl(item.imageUrl)} alt="" className="w-12 h-12 object-cover rounded-lg border shadow-sm" onError={(e) => {e.target.onerror = null; e.target.src="https://placehold.co/100?text=Error"}} /></td>
                  <td className="px-4 py-3 font-bold text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.categoryName}</span></td>
                  <td className="px-4 py-3 font-mono text-gray-700">{formatCurrency(item.price)}</td>
                  <td className="px-4 py-3"><button onClick={() => onToggleStock(item.id)} className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${item.isOutOfStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{item.isOutOfStock ? 'Hết hàng' : 'Còn hàng'}</button></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => onEditMenuItem(item)} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded font-medium mr-1 transition">Sửa</button><button onClick={() => onDeleteMenuItem(item.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-medium transition">Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TableManagementView({ tables, onAddTable, onEditTable, onDeleteTable, onShowQr }) {
    return (<div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-gray-800">Danh sách Bàn</h2><button onClick={onAddTable} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow">+ Thêm Bàn</button></div><div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[500px]"><thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold"><tr><th className="px-6 py-3 rounded-l-lg">Tên Bàn</th><th className="px-6 py-3">Sức chứa</th><th className="px-6 py-3 text-right rounded-r-lg">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{tables.map(table => (<tr key={table.id} className="hover:bg-gray-50 transition"><td className="px-6 py-4 font-bold text-gray-800 text-lg">{table.name}</td><td className="px-6 py-4 text-gray-500">{table.capacity} người</td><td className="px-6 py-4 text-right"><button onClick={() => onShowQr(table)} className="bg-gray-100 text-gray-700 px-3 py-1 rounded mr-2 hover:bg-gray-200 text-xs font-bold transition">QR CODE</button><button onClick={() => onEditTable(table)} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded font-medium mr-1 transition">Sửa</button><button onClick={() => onDeleteTable(table.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-medium transition">Xóa</button></td></tr>))}</tbody></table></div></div>);
}

// (UserManagementView, StoreSettingsView, LoginView, UserEditModal, TableEditModal, MenuItemEditModal - GIỮ NGUYÊN logic của bạn, copy từ phiên bản trước nếu cần)
// Để ngắn gọn, tôi viết rút gọn các hàm này nhưng vẫn đảm bảo hoạt động

function UserManagementView({ users, onAddUser, onEditUser, onDeleteUser }) {
    return (<div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-gray-800">Danh sách Nhân viên</h2><button onClick={onAddUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow">+ Thêm NV</button></div><div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[500px]"><thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold"><tr><th className="px-6 py-3 rounded-l-lg">Username</th><th className="px-6 py-3">Vai trò</th><th className="px-6 py-3 text-right rounded-r-lg">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{users.map(user => (<tr key={user.id} className="hover:bg-gray-50 transition"><td className="px-6 py-4 font-bold text-gray-800">{user.username}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : user.role === 'KITCHEN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{user.role}</span></td><td className="px-6 py-4 text-right"><button onClick={() => onEditUser(user)} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded font-medium mr-1 transition">Sửa</button><button onClick={() => onDeleteUser(user.id)} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded font-medium transition">Xóa</button></td></tr>))}</tbody></table></div></div>);
}
function StoreSettingsView({ settings, onSave }) {
    const [bankId, setBankId] = useState(''); const [accountNo, setAccountNo] = useState(''); const [accountName, setAccountName] = useState(''); const [qrTemplate, setQrTemplate] = useState('compact');
    useEffect(() => { if (settings) { setBankId(settings.bankId || ''); setAccountNo(settings.accountNo || ''); setAccountName(settings.accountName || ''); setQrTemplate(settings.qrTemplate || 'compact'); } }, [settings]);
    return (<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto"><h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Cấu hình Ngân hàng (VietQR)</h2><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Ngân hàng</label><input value={bankId} onChange={e => setBankId(e.target.value.toUpperCase())} className="w-full border p-2 rounded" placeholder="MB, VCB..." /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Số tài khoản</label><input value={accountNo} onChange={e => setAccountNo(e.target.value)} className="w-full border p-2 rounded" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Tên chủ TK</label><input value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full border p-2 rounded" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Template</label><select value={qrTemplate} onChange={e => setQrTemplate(e.target.value)} className="w-full border p-2 rounded"><option value="compact">Compact</option><option value="qr_only">QR Only</option><option value="print">Print</option></select></div><div className="pt-4"><button onClick={() => onSave({ bankId, accountNo, accountName, qrTemplate })} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">Lưu Cấu hình</button></div></div></div>);
}
function LoginView({ onLogin, loading, error }) {const [u, setU] = useState('admin'); const [p, setP] = useState('admin'); return (<div className="flex items-center justify-center min-h-screen bg-gray-100 p-4"><div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm"><h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Panel</h2><form onSubmit={e=>{e.preventDefault(); onLogin(u,p)}} className="space-y-4"><input value={u} onChange={e=>setU(e.target.value)} className="w-full border p-2 rounded" placeholder="Username" /><input type="password" value={p} onChange={e=>setP(e.target.value)} className="w-full border p-2 rounded" placeholder="Password" />{error && <p className="text-red-500 text-sm text-center">{error}</p>}<button disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg">{loading?'Checking...':'Login'}</button></form></div></div>);}
function UserEditModal({ user, onClose, onSave }) {const [u, setU] = useState(user?.username||''); const [p, setP] = useState(''); const [r, setR] = useState(user?.role||'STAFF'); return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"><h2 className="text-xl font-bold mb-4">{user?'Sửa':'Thêm'} NV</h2><div className="space-y-4"><input value={u} onChange={e=>setU(e.target.value)} className="w-full border p-2 rounded" placeholder="Username"/><input type="password" value={p} onChange={e=>setP(e.target.value)} className="w-full border p-2 rounded" placeholder="Password"/><select value={r} onChange={e=>setR(e.target.value)} className="w-full border p-2 rounded"><option value="STAFF">Staff</option><option value="KITCHEN">Kitchen</option><option value="ADMIN">Admin</option></select></div><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Hủy</button><button onClick={()=>onSave({id:user?.id, username:u, password:p||null, role:r})} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Lưu</button></div></div></div>);}
function TableEditModal({ table, onClose, onSave }) {const [n, setN] = useState(table?.name||''); const [c, setC] = useState(table?.capacity||4); return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"><h2 className="text-xl font-bold mb-4">{table?'Sửa':'Thêm'} Bàn</h2><div className="space-y-4"><input value={n} onChange={e=>setN(e.target.value)} className="w-full border p-2 rounded" placeholder="Tên bàn" /><input type="number" value={c} onChange={e=>setC(e.target.value)} className="w-full border p-2 rounded" placeholder="Sức chứa" /></div><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Hủy</button><button onClick={()=>onSave({id:table?.id, name:n, capacity:c})} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Lưu</button></div></div></div>);}
function MenuItemEditModal({ menuItem, categories, onClose, onSave }) {const [n, setN] = useState(menuItem?.name||''); const [d, setD] = useState(menuItem?.description||''); const [p, setP] = useState(menuItem?.price||''); const [c, setC] = useState(menuItem?.categoryId || categories[0]?.id); const [s, setS] = useState(menuItem?.isOutOfStock||false); const [f, setF] = useState(null); const [prev, setPrev] = useState(menuItem?.imageUrl); const handleFile = (e) => { if(e.target.files[0]) { setF(e.target.files[0]); setPrev(URL.createObjectURL(e.target.files[0])); } }; return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden"><div className="p-4 border-b font-bold text-lg bg-gray-50">{menuItem ? 'Sửa' : 'Thêm'} Món</div><div className="p-6 space-y-4 overflow-y-auto flex-1"><div><label className="block text-sm font-bold mb-1">Tên</label><input value={n} onChange={e=>setN(e.target.value)} className="w-full border p-2 rounded" required /></div><div><label className="block text-sm font-bold mb-1">Danh mục</label><select value={c} onChange={e=>setC(e.target.value)} className="w-full border p-2 rounded bg-white">{categories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div><div><label className="block text-sm font-bold mb-1">Giá</label><input type="number" value={p} onChange={e=>setP(e.target.value)} className="w-full border p-2 rounded" required /></div><div><label className="block text-sm font-bold mb-1">Mô tả</label><textarea value={d} onChange={e=>setD(e.target.value)} className="w-full border p-2 rounded" rows={2}></textarea></div><div><label className="block text-sm font-bold mb-1">Ảnh</label>{prev && <img src={prev} alt="" className="h-32 w-full object-cover rounded-lg mb-2 border" />}<input type="file" onChange={handleFile} className="text-sm w-full" /></div><div><label className="block text-sm font-bold mb-1">Trạng thái</label><select value={s} onChange={e=>setS(e.target.value==='true')} className="w-full border p-2 rounded bg-white"><option value="false">Còn hàng</option><option value="true">Hết hàng</option></select></div></div><div className="p-4 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Hủy</button><button onClick={()=>onSave({id:menuItem?.id, name:n, description:d, price:p, categoryId:c, isOutOfStock:s, imageUrl:menuItem?.imageUrl}, f)} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Lưu</button></div></div></div>);}

// [CẬP NHẬT] QrCodeModal tạo link động
function QrCodeModal({ table, onClose }) {
  const [qr, setQr] = useState('');
  const keyToUse = table.accessKey || table.id;
  useEffect(() => { 
      if (window.QRCode) { 
          // Link động: http://[domain]/?table=[key]
          const url = `${window.location.origin}/?table=${keyToUse}`; 
          window.QRCode.toDataURL(url, { width: 300, margin: 2 }, (err, u) => !err && setQr(u)); 
      } 
  }, [table, keyToUse]);
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center"><h2 className="text-xl font-bold mb-4">Mã QR: {table.name}</h2>{qr ? <><img src={qr} alt="QR" className="border rounded-lg mb-4" /><a href={qr} download={`QR_${table.name}.png`} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold w-full text-center">Tải về</a></> : <p>Đang tạo...</p>}<button onClick={onClose} className="mt-4 text-gray-500 hover:underline">Đóng</button></div></div>);
}
