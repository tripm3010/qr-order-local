import React, { useState, useEffect, useRef, useMemo } from 'react';

// Giả định các thư viện (axios, sockjs, stomp) đã được tải qua CDN trong public/index.html

let apiClient; 

// Helper lấy URL API tự động (Hỗ trợ cả Local và Production HTTPS)
const getApiBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    // 1. Dev mode (npm start port 3000) -> Gọi về 8080
    if (port === '3000') {
        return `${protocol}//${hostname}:8080/api`;
    }
    // 2. Production (Docker/Nginx port 80/443) -> Gọi relative path
    // Trình duyệt sẽ tự động thêm https://domain.com vào trước
    return '/api';
};

export default function KitchenView() {
  const [token, setToken] = useState(null); 
  const [storeId, setStoreId] = useState(null); 
  const [activeOrders, setActiveOrders] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const stompClientRef = useRef(null);

  // === 1. ĐĂNG NHẬP ===
  const handleLogin = async (username, password) => {
    if (!window.axios) { setError("Lỗi: Thư viện Axios chưa tải."); return; }
    
    // [HTTPS FIX] Sử dụng hàm helper để lấy URL chuẩn
    const baseURL = getApiBaseUrl();
    const loginApiClient = window.axios.create({ baseURL });

    try {
      setLoading(true);
      const response = await loginApiClient.post('/auth/login', { username, password });
      const jwt = response.data.jwt;
      
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      // Kiểm tra quyền (Bếp hoặc Admin)
      if (!payload.role || (!payload.role.includes('KITCHEN') && !payload.role.includes('ADMIN') && !payload.role.includes('SUPER_ADMIN'))) {
         setError("Tài khoản không có quyền truy cập Bếp."); 
         setLoading(false); 
         return;
      }

      setToken(jwt);
      setStoreId(payload.storeId);
      
      apiClient = window.axios.create({ 
          baseURL, 
          headers: { 'Authorization': `Bearer ${jwt}` } 
      });
      setError(null);
    } catch (err) { 
        console.error(err);
        setError("Đăng nhập thất bại."); 
    } finally { setLoading(false); }
  };

  // === 2. TẢI DỮ LIỆU ===
  const fetchActiveOrders = async () => {
    if (!apiClient) return;
    setLoading(true);
    try { 
        const res = await apiClient.get('/kitchen/orders');
        setActiveOrders(res.data); 
    } catch (err) { 
        console.error(err);
        setError("Không thể tải danh sách đơn hàng."); 
    } finally {
        setLoading(false);
    }
  };

  // === 3. KẾT NỐI WEBSOCKET ===
  useEffect(() => {
    if (token && apiClient) {
      fetchActiveOrders();
      
      if (window.StompJs && window.SockJS) {
        // [HTTPS FIX] Logic tạo URL WebSocket an toàn
        const baseUrl = getApiBaseUrl();
        // Nếu là đường dẫn tương đối '/api', thay thành '/ws'
        // Nếu là tuyệt đối http://.../api, thay thành http://.../ws
        const wsUrl = baseUrl.startsWith('/') ? '/ws' : baseUrl.replace('/api', '/ws');
        
        const stompClient = new window.StompJs.Client({
          webSocketFactory: () => new window.SockJS(wsUrl),
          reconnectDelay: 5000,
          // debug: (str) => console.log('STOMP: ' + str),
          onConnect: () => {
            console.log('BẾP: ĐÃ KẾT NỐI WEBSOCKET!');
            
            const kitchenTopic = `/topic/kitchen/${storeId}`;
            stompClient.subscribe(kitchenTopic, (message) => {
              const newOrder = JSON.parse(message.body);
              console.log("Bếp nhận đơn:", newOrder);
              
              setActiveOrders(prevOrders => {
                 const exists = prevOrders.find(o => o.id === newOrder.id);
                 
                 if (exists) {
                     // Nếu đơn hàng chuyển sang trạng thái hoàn tất/thanh toán/hủy -> Xóa khỏi màn hình bếp
                     if (['COMPLETED', 'PAID', 'SERVED', 'CANCELLED'].includes(newOrder.status)) {
                         return prevOrders.filter(o => o.id !== newOrder.id);
                     }
                     // Nếu cập nhật (ví dụ thêm món) -> Update
                     return prevOrders.map(o => o.id === newOrder.id ? newOrder : o);
                 } else {
                     // Nếu là đơn mới (PENDING/PREPARING) -> Thêm vào
                     if (['PENDING', 'PREPARING'].includes(newOrder.status)) {
                         return [newOrder, ...prevOrders]; // Đưa đơn mới lên đầu
                     }
                     return prevOrders;
                 }
              });
            });
          },
        });
        stompClient.activate();
        stompClientRef.current = stompClient;
      }
    }
    return () => { if (stompClientRef.current) stompClientRef.current.deactivate(); };
  }, [token, storeId]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (!apiClient) return;
    try {
      const res = await apiClient.post(`/kitchen/order/${orderId}/status`, { newStatus });
      const updatedOrder = res.data;
      
      setActiveOrders(prevOrders => {
        // Nếu chuyển sang PREPARING -> Cập nhật trạng thái
        if (newStatus === 'PREPARING') {
            return prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        }
        // Nếu chuyển sang COMPLETED -> Xóa khỏi màn hình (để gọn)
        return prevOrders.filter(o => o.id !== updatedOrder.id);
      });
    } catch (err) { 
        alert("Lỗi cập nhật trạng thái."); 
    }
  };

  // === RENDER ===
  if (!token) return <LoginView onLogin={handleLogin} loading={loading} error={error} />;

  return (
    <div className="font-sans antialiased bg-gray-800 min-h-screen p-4">
      <header className="mb-6 flex justify-between items-center bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-700 text-white">
        <div className="flex items-center gap-3">
            <span className="text-3xl">👨‍🍳</span>
            <div>
                <h1 className="text-2xl font-bold">BẾP TRUNG TÂM</h1>
                <p className="text-xs text-gray-400">Chi nhánh ID: {storeId}</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
             {loading && <span className="text-blue-400 font-bold animate-pulse">Đang đồng bộ...</span>}
             <div className="text-right mr-4">
                 <p className="text-xl font-bold">{activeOrders.length}</p>
                 <p className="text-xs text-gray-400">Đơn chờ</p>
             </div>
             <button onClick={() => setToken(null)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition">Đăng xuất</button>
        </div>
      </header>
      
      {error && <p className="text-red-200 bg-red-900/50 border border-red-800 font-semibold mb-6 p-4 rounded-lg">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeOrders.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-32 text-gray-500">
                <span className="text-6xl mb-4">✅</span>
                <p className="text-2xl">Đã hoàn thành tất cả đơn hàng!</p>
            </div>
        )}
        {activeOrders.map(order => (
          <OrderCard key={order.id} order={order} onUpdateStatus={handleUpdateStatus} />
        ))}
      </div>
    </div>
  );
}

// --- COMPONENT CON ---

function LoginView({ onLogin, loading, error }) {
  const [u, setU] = useState('admin'); 
  const [p, setP] = useState('admin'); 
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="p-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="text-center mb-8">
                <span className="text-6xl">👨‍🍳</span>
                <h2 className="text-3xl font-bold text-gray-800 mt-4">Đăng nhập Bếp</h2>
                <p className="text-gray-500 text-sm">Hệ thống hiển thị đơn hàng nhà bếp</p>
            </div>
            
            <form onSubmit={(e) => {e.preventDefault(); onLogin(u, p)}} className="space-y-5">
                <div>
                    <label className="block text-gray-700 mb-2 font-bold text-sm">Tên đăng nhập</label>
                    <input type="text" value={u} onChange={(e) => setU(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Username" />
                </div>
                <div>
                    <label className="block text-gray-700 mb-2 font-bold text-sm">Mật khẩu</label>
                    <input type="password" value={p} onChange={(e) => setP(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Password" />
                </div>
                
                {error && <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>}
                
                <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition shadow-lg transform active:scale-95">
                    {loading ? 'Đang kết nối...' : 'VÀO BẾP'}
                </button>
            </form>
        </div>
    </div>
  );
}

function OrderCard({ order, onUpdateStatus }) {
  const isPending = order.status === 'PENDING';
  
  return (
    <div className={`flex flex-col h-full bg-white rounded-xl shadow-xl overflow-hidden border-t-8 transform transition hover:-translate-y-1 duration-200 ${isPending ? 'border-yellow-400' : 'border-blue-500'}`}>
      {/* Header Card */}
      <div className={`px-5 py-3 flex justify-between items-center border-b ${isPending ? 'bg-yellow-50' : 'bg-blue-50'}`}>
        <div>
            <h3 className="text-2xl font-black text-gray-800">Bàn {order.tableName}</h3>
            <p className="text-sm text-gray-500 font-mono">#{order.id}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      
      {/* List Items */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[300px]">
        <ul className="space-y-4">
          {order.items.map(item => (
            <li key={item.id} className="flex flex-col border-b border-dashed border-gray-200 pb-3 last:border-0 last:pb-0">
               <div className="flex items-baseline gap-2">
                   <span className="font-black text-2xl text-gray-800 w-8 text-right">{item.quantity}</span>
                   <span className="text-lg font-bold text-gray-700">{item.menuItemName}</span>
               </div>
               
               {/* Hiển thị Note nổi bật cho Bếp */}
               {item.note && (
                  <div className="ml-10 mt-1 self-start text-red-600 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-start gap-2">
                      <span>⚠️</span>
                      <span>{item.note}</span>
                  </div>
               )}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="text-xs text-gray-500 mt-2 mb-4 text-right italic">
        Đặt lúc: {new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
      </div>

      <div className="mt-auto pt-2 border-t border-gray-200">
        {isPending ? (
          <button 
            onClick={() => onUpdateStatus(order.id, 'PREPARING')}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-md transition active:scale-95 text-lg flex items-center justify-center gap-2"
          >
            <span>🔥</span> BẮT ĐẦU NẤU
          </button>
        ) : (
          <button 
            onClick={() => onUpdateStatus(order.id, 'COMPLETED')}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 shadow-md transition active:scale-95 text-lg flex items-center justify-center gap-2"
          >
            <span>✅</span> HOÀN THÀNH
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-yellow-400 text-yellow-900',
    PREPARING: 'bg-blue-500 text-white',
    COMPLETED: 'bg-green-500 text-white',
  };
  const text = {
    PENDING: '⏳ ĐANG CHỜ',
    PREPARING: '🔥 ĐANG NẤU',
    COMPLETED: '✅ ĐÃ XONG',
  };
  return (
    <span className={`px-3 py-1 rounded-full font-bold text-xs shadow-sm ${styles[status] || styles.PENDING}`}>
      {text[status] || status}
    </span>
  );
}
