import React, { useState, useEffect, useMemo, useRef } from 'react';

// Giả định các thư viện (axios, sockjs, stomp) đã được tải qua CDN

let apiClient;

// [HTTPS FIX] Helper lấy URL API tự động
const getApiBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    // 1. Dev mode (npm start port 3000) -> Gọi về 8080
    if (port === '3000') {
        return `${protocol}//${hostname}:8080/api`;
    }
    // 2. Production (Docker/Nginx port 80/443) -> Gọi relative path
    return '/api';
};

// [HTTPS FIX] Helper hiển thị ảnh
const getImageUrl = (url) => {
    if (!url) return 'https://placehold.co/300x200/EEE/CCC?text=Món+ăn';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Ghép host hiện tại vào đường dẫn tương đối
    return window.location.origin + url;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

export default function CustomerView() {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [placedOrders, setPlacedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [itemToOrder, setItemToOrder] = useState(null); 

  const [libsReady, setLibsReady] = useState(false);
  const [wsReady, setWsReady] = useState(false);

  const [tableInfo, setTableInfo] = useState({ id: null, name: '...' });
  const tableAccessKey = useMemo(() => new URLSearchParams(window.location.search).get('table'), []);

  const stompClientRef = useRef(null);
  const apiIntervalRef = useRef(null);
  const wsIntervalRef = useRef(null);

  // === 1. TẢI DỮ LIỆU BAN ĐẦU ===
  useEffect(() => {
    if (!tableAccessKey) { setError('Vui lòng quét mã QR hợp lệ.'); setLoading(false); return; }
    
    if (apiIntervalRef.current) clearInterval(apiIntervalRef.current);

    const attemptToFetchMenu = () => {
      if (window.axios) {
        if (apiIntervalRef.current) clearInterval(apiIntervalRef.current);
        setLibsReady(true);

        if (!apiClient) {
          // [HTTPS FIX] Dùng helper để lấy URL
          const baseURL = getApiBaseUrl();
          apiClient = window.axios.create({ baseURL });
        }

        const fetchMenu = async () => {
          try {
            const tableRes = await apiClient.get(`/public/tables/${tableAccessKey}/info`);
            setTableInfo(tableRes.data); 

            const [catRes, itemRes, ordersRes] = await Promise.all([
              apiClient.get('/public/categories'),
              apiClient.get('/public/menu-items'),
              apiClient.get(`/public/tables/${tableAccessKey}/orders`)
            ]);
            
            setCategories(catRes.data);
            setMenuItems(itemRes.data);
            setPlacedOrders(ordersRes.data);
            if (catRes.data.length > 0) setSelectedCategoryId(catRes.data[0].id);
            setError(null);
          } catch (err) { 
            console.error(err);
            setError('Lỗi tải dữ liệu. Mã bàn có thể không đúng.'); 
          } finally { setLoading(false); }
        };
        fetchMenu();
      }
    };
    
    attemptToFetchMenu();
    apiIntervalRef.current = setInterval(attemptToFetchMenu, 200);
    return () => { if (apiIntervalRef.current) clearInterval(apiIntervalRef.current); };
  }, [tableAccessKey]);

  // === 2. KẾT NỐI WEBSOCKET ===
  useEffect(() => {
    if (!tableInfo.id) return; 
    
    if (wsIntervalRef.current) clearInterval(wsIntervalRef.current);
    let stompCleanup = () => {}; 

    const attemptToConnect = () => {
      if (window.StompJs && window.SockJS) {
        if (wsIntervalRef.current) clearInterval(wsIntervalRef.current);
        setWsReady(true); 
        
        // [HTTPS FIX] Logic tạo URL WebSocket an toàn
        const baseUrl = getApiBaseUrl();
        // Nếu là đường dẫn tương đối '/api', thay thành '/ws'
        // Nếu là tuyệt đối http://.../api, thay thành http://.../ws
        const wsUrl = baseUrl.startsWith('/') ? '/ws' : baseUrl.replace('/api', '/ws');
        
        const stompClient = new window.StompJs.Client({
          webSocketFactory: () => new window.SockJS(wsUrl),
          reconnectDelay: 10000,
          // debug: (str) => console.log(str),
          onConnect: () => {
            console.log("ĐÃ KẾT NỐI WEBSOCKET");
            const tableTopic = `/topic/table/${tableInfo.id}`;
            stompClient.subscribe(tableTopic, (message) => {
              const updatedOrder = JSON.parse(message.body);
              setPlacedOrders(prev => {
                const exists = prev.find(o => o.id === updatedOrder.id);
                if (exists) {
                     return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
                } else {
                     return [updatedOrder, ...prev];
                }
              });
            });
          },
        });
        stompClient.activate();
        stompClientRef.current = stompClient;
        stompCleanup = () => { if (stompClientRef.current) stompClientRef.current.deactivate(); };
      }
    };
    attemptToConnect();
    wsIntervalRef.current = setInterval(attemptToConnect, 200);
    return () => { if (wsIntervalRef.current) clearInterval(wsIntervalRef.current); stompCleanup(); };
  }, [tableInfo.id]);

  // === 3. LOGIC GIỎ HÀNG ===
  
  const addToCart = (item, quantity, note) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.id === item.id && i.note === note);
      if (existingIndex !== -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += quantity;
        return newCart;
      } else {
        return [...prev, { ...item, quantity, note, cartId: Date.now() }];
      }
    });
    setItemToOrder(null); 
  };

  const removeFromCart = (indexToRemove) => {
    setCart(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!apiClient) return;
    
    const orderRequest = {
      tableAccessKey: tableAccessKey, 
      items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, note: i.note }))
    };

    try {
      setLoading(true);
      await apiClient.post('/public/order', orderRequest);
      setCart([]); setIsCartOpen(false);
    } catch (err) { alert('Lỗi đặt hàng.'); } finally { setLoading(false); }
  };

  const handleCallStaff = (type) => {
    if (stompClientRef.current?.connected && tableInfo.id) {
      stompClientRef.current.publish({ 
          destination: '/app/call-staff', 
          body: JSON.stringify({ tableId: tableInfo.id, callType: type }) 
      });
      alert(type === 'PAYMENT' ? 'Đã gọi thanh toán!' : 'Đã gọi nhân viên!');
    } else alert('Lỗi kết nối.');
  };

  const outstandingTotal = useMemo(() => placedOrders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED').reduce((sum, o) => sum + o.totalPrice + (o.surcharge || 0), 0), [placedOrders]);
  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart]);
  const totalQuantity = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);
  const filteredItems = selectedCategoryId ? menuItems.filter(item => item.categoryId === selectedCategoryId) : [];

  // === RENDER ===
  if (loading || !libsReady || !wsReady) return <div className="flex h-screen items-center justify-center bg-gray-50 text-orange-600 font-bold">Đang tải...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-red-50 text-red-600 p-4 text-center">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-32 font-sans flex flex-col h-screen overflow-hidden">
      
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex justify-between items-center shrink-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{tableInfo.name}</h1>
          <p className="text-xs text-gray-500">Xin chào quý khách</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleCallStaff('SERVICE')} className="bg-blue-50 text-blue-600 p-2 rounded-lg shadow-sm hover:bg-blue-100 text-xs font-bold">🛎️ Gọi NV</button>
          <button onClick={() => handleCallStaff('PAYMENT')} className="bg-green-50 text-green-600 p-2 rounded-lg shadow-sm hover:bg-green-100 text-xs font-bold">💸 Bill</button>
        </div>
      </div>

      {/* Tab Danh mục */}
      <div className="bg-white border-b shrink-0 shadow-sm">
        <div className="flex overflow-x-auto no-scrollbar px-4 py-3 gap-3">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-orange-600 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat.name}</button>
          ))}
        </div>
      </div>

      {/* Danh sách Món */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 pb-4">
          {filteredItems.map(item => (
            <MenuItemCard key={item.id} item={item} onAdd={() => setItemToOrder(item)} />
          ))}
        </div>
      </div>

      {/* Floating Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.1)] z-20 border-t safe-area-pb">
        {outstandingTotal > 0 && <div className="bg-orange-50 px-4 py-2 text-xs text-orange-800 flex justify-between border-b border-orange-100"><span>Đã gọi (chưa TT):</span><span className="font-bold text-base">{formatCurrency(outstandingTotal)}</span></div>}
        <div className="p-3 flex justify-between items-center gap-3">
          <div className="flex-1 cursor-pointer" onClick={() => setIsCartOpen(true)}>
            <div className="flex items-center gap-3">
               <div className="relative"><span className="text-3xl">🛒</span>{totalQuantity > 0 && <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">{totalQuantity}</span>}</div>
               <div className="flex flex-col"><span className="font-bold text-lg text-gray-900 leading-tight">{formatCurrency(cartTotal)}</span><span className="text-[10px] text-gray-500 font-medium">Xem chi tiết giỏ hàng</span></div>
            </div>
          </div>
          <button onClick={() => setIsCartOpen(true)} disabled={cart.length === 0 && placedOrders.length === 0} className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 disabled:bg-gray-300">{cart.length > 0 ? 'Đặt hàng' : 'Đơn hàng'}</button>
        </div>
      </div>

      {/* Modal Giỏ hàng */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:w-[500px] h-[90vh] sm:h-[85vh] sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl animate-slide-up">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl"><h2 className="text-xl font-bold text-gray-800">Giỏ hàng của bạn</h2><button onClick={() => setIsCartOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Giỏ hàng mới */}
              {cart.length > 0 && (
                <div>
                  <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2 border-b border-orange-100 pb-2">✨ Món mới (Chưa gửi)</h3>
                  <div className="space-y-3">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex flex-col bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1"><p className="font-semibold text-gray-800">{item.name} <span className="text-orange-600 font-bold">x{item.quantity}</span></p><p className="text-sm text-gray-500">{formatCurrency(item.price * item.quantity)}</p></div>
                          <button onClick={() => removeFromCart(idx)} className="text-red-500 font-bold px-2">✕</button>
                        </div>
                        {item.note && <p className="text-xs text-gray-600 italic bg-gray-50 mt-2 p-1 rounded border border-gray-100">📝 {item.note}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between items-center px-2 font-bold text-gray-700"><span>Tạm tính:</span><span>{formatCurrency(cartTotal)}</span></div>
                  <button onClick={handlePlaceOrder} className="w-full mt-4 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-orange-700 active:scale-95 transition">Xác nhận gọi món</button>
                </div>
              )}
              {/* Lịch sử gọi món */}
              {placedOrders.length > 0 && (
                <div className={cart.length > 0 ? "pt-6 border-t-2 border-dashed border-gray-200" : ""}>
                  <h3 className="font-bold text-gray-700 mb-3 pb-2">📋 Lịch sử gọi món</h3>
                  <div className="space-y-3">
                    {placedOrders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED').map(order => (
                      <div key={order.id} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-500">Đơn #{order.id}</span><StatusBadge status={order.status} /></div>
                        <ul className="space-y-2 pl-0">
                          {order.items.map(i => (
                            <li key={i.id} className="flex flex-col border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                               <div className="flex justify-between text-sm"><span><span className="font-bold">{i.quantity}x</span> {i.menuItemName}</span><span className="text-gray-600 font-medium">{formatCurrency(i.priceAtOrder * i.quantity)}</span></div>
                               {i.note && <span className="text-xs text-orange-600 italic mt-0.5">📝 {i.note}</span>}
                            </li>
                          ))}
                          {order.surcharge > 0 && <li className="flex justify-between text-sm text-blue-600 font-medium pt-2 border-t border-dashed border-gray-200 mt-1"><span>Phụ phí ({order.surchargeNotes})</span><span>{formatCurrency(order.surcharge)}</span></li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-white border-t shadow-sm flex justify-between items-center z-10"><span className="text-gray-600 font-medium">Tổng thanh toán:</span><span className="text-2xl font-bold text-blue-700">{formatCurrency(cartTotal + outstandingTotal)}</span></div>
          </div>
        </div>
      )}

      {/* Modal Chọn món & Ghi chú */}
      {itemToOrder && (
        <ProductDetailModal 
            item={itemToOrder} 
            onClose={() => setItemToOrder(null)}
            onAddToCart={addToCart}
        />
      )}
    </div>
  );
}

// --- CÁC COMPONENT CON ---

function MenuItemCard({ item, onAdd }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full active:shadow-md transition-all duration-200 ${item.isOutOfStock ? 'opacity-60 grayscale' : ''}`} onClick={onAdd}>
      <div className="aspect-[4/3] relative bg-gray-100">
        {/* [HTTPS FIX] Sử dụng getImageUrl cho ảnh */}
        <img src={getImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" onError={(e) => {e.target.onerror = null; e.target.src="https://placehold.co/300?text=No+Image"}} />
        {item.isOutOfStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide shadow-lg">Hết hàng</span></div>}
      </div>
      <div className="p-3 flex flex-col flex-1 justify-between">
        <div><h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1">{item.name}</h3><p className="text-[11px] text-gray-500 line-clamp-2 mb-2">{item.description}</p></div>
        <div className="flex justify-between items-end mt-2"><span className="font-bold text-orange-600 text-sm">{formatCurrency(item.price)}</span><button disabled={item.isOutOfStock} className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-lg hover:bg-orange-600 hover:text-white transition disabled:bg-gray-200 disabled:text-gray-400 shadow-sm">+</button></div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { PENDING: 'bg-yellow-100 text-yellow-700', PREPARING: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-green-100 text-green-700', SERVED: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-transparent ${map[status]?.color || 'bg-gray-100'}`}>{map[status]?.text || status}</span>;
}

function ProductDetailModal({ item, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
  
    const handleConfirm = () => {
      onAddToCart(item, quantity, note);
    };
  
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white w-full sm:w-[400px] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="flex gap-4 mb-5">
             {/* [HTTPS FIX] Sử dụng getImageUrl cho ảnh */}
             <img src={getImageUrl(item.imageUrl)} className="w-20 h-20 object-cover rounded-xl bg-gray-100 border" alt="" onError={(e) => {e.target.src="https://placehold.co/100"}}/>
             <div className="flex-1">
               <h3 className="text-lg font-bold text-gray-800 line-clamp-2">{item.name}</h3>
               <p className="text-orange-600 font-bold text-lg">{formatCurrency(item.price)}</p>
               <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 self-start text-2xl leading-none">×</button>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Ghi chú món ăn</label>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="VD: Không hành, ít đá, mang về..." 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 pl-9 focus:border-orange-500 focus:ring-0 outline-none text-sm transition"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                />
                <span className="absolute left-3 top-3 text-gray-400">✎</span>
            </div>
          </div>
  
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center border-2 border-gray-200 rounded-xl h-12 w-32 justify-between px-2">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition text-xl">-</button>
                <span className="text-lg font-bold text-gray-800">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center font-bold text-orange-600 hover:bg-orange-50 rounded-lg transition text-xl">+</button>
             </div>
             <button 
               onClick={handleConfirm}
               className="flex-1 bg-orange-600 text-white h-12 rounded-xl font-bold shadow-lg hover:bg-orange-700 active:scale-95 transition flex items-center justify-center gap-2"
             >
               <span>Thêm</span>
               <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{formatCurrency(item.price * quantity)}</span>
             </button>
          </div>
        </div>
      </div>
    );
}
