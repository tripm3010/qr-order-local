import React, { useState, useEffect, useMemo, useRef } from 'react';

// Giả định các thư viện (axios, sockjs, stomp) có sẵn
let apiClient; 

// [SỬA LỖI HTTPS] Helper xác định URL API tự động
const getApiBaseUrl = () => {
    const { hostname, port, protocol } = window.location;
    // 1. Dev mode (npm start port 3000) -> Gọi về 8080
    if (port === '3000') {
        return `${protocol}//${hostname}:8080/api`;
    }
    // 2. Production (Docker/Nginx port 80/443) -> Dùng đường dẫn tương đối
    // Trình duyệt sẽ tự động thêm https://domain.com vào trước
    return '/api';
};

// Cấu hình mặc định
const BANK_CONFIG_DEFAULT = {
  BANK_ID: 'MB',         
  ACCOUNT_NO: '0000000000', 
  TEMPLATE: 'compact',   
  ACCOUNT_NAME: 'NHA HANG' 
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

export default function StaffView() {
  const [token, setToken] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [subdomain, setSubdomain] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // States nghiệp vụ
  const [tableMap, setTableMap] = useState([]); 
  const [notifications, setNotifications] = useState([]); 
  const [selectedTable, setSelectedTable] = useState(null); 
  const [tableOrders, setTableOrders] = useState([]); 
  const [menuItems, setMenuItems] = useState([]); 
  const [bankConfig, setBankConfig] = useState(null); 

  // States Modals
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [qrModalTable, setQrModalTable] = useState(null);
  const [surchargeModalOrder, setSurchargeModalOrder] = useState(null);
  const [addItemModalOrder, setAddItemModalOrder] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [printableContent, setPrintableContent] = useState(null);

  const stompClientRef = useRef(null);
  const tableSubscriptionRef = useRef(null);

  // === 1. LOGIN & FETCH DATA ===
  const handleLogin = async (username, password) => {
    if (!window.axios) { setError("Lỗi: Thư viện Axios chưa tải."); return; }
    
    // [SỬA LỖI] Dùng helper để lấy URL chuẩn (HTTPS safe)
    const loginUrl = getApiBaseUrl();
    const loginApiClient = window.axios.create({ baseURL: loginUrl });

    try {
      setLoading(true);
      const response = await loginApiClient.post('/auth/login', { username, password });
      const jwt = response.data.jwt;
      
      setToken(jwt);
      setSubdomain(response.data.subdomain); 
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      setStoreId(payload.storeId);

      apiClient = window.axios.create({
        baseURL: loginUrl,
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      setError(null);
    } catch (err) { 
        console.error(err); 
        setError("Đăng nhập thất bại. Vui lòng kiểm tra tài khoản."); 
    } finally { setLoading(false); }
  };

  const fetchTableMap = async () => {
    if (!apiClient) return; 
    try { setTableMap((await apiClient.get('/staff/tables')).data); } catch (err) { setError("Lỗi tải sơ đồ bàn."); }
  };
  
  const fetchMenu = async () => {
    if (!apiClient) return;
    try { setMenuItems((await apiClient.get('/public/menu-items')).data); } catch (err) {}
  }

  const fetchStoreConfig = async () => {
    if (!apiClient) return;
    try { 
        const res = await apiClient.get('/staff/store/settings');
        setBankConfig(res.data);
    } catch (e) { console.log("Dùng cấu hình mặc định"); }
  };

  // === 2. WEBSOCKET ===
  useEffect(() => {
    if (token && apiClient && storeId) {
      fetchTableMap(); fetchMenu(); fetchStoreConfig();

      if (window.StompJs && window.SockJS) {
        // [SỬA LỖI HTTPS] Tự động dùng wss:// nếu đang ở https://
        // SockJS cần đường dẫn tương đối (nếu cùng domain) hoặc tuyệt đối
        const baseUrl = getApiBaseUrl();
        // Nếu là đường dẫn tương đối '/api', thay thành '/ws'
        // Nếu là tuyệt đối http://.../api, thay thành http://.../ws
        const wsUrl = baseUrl.startsWith('/') ? '/ws' : baseUrl.replace('/api', '/ws');
        
        const stompClient = new window.StompJs.Client({
          webSocketFactory: () => new window.SockJS(wsUrl),
          reconnectDelay: 5000,
          onConnect: () => {
            console.log('STAFF: ĐÃ KẾT NỐI WEBSOCKET!');
            stompClient.subscribe(`/topic/staff/${storeId}`, (msg) => {
                const newCall = JSON.parse(msg.body);
                setNotifications(prev => [newCall, ...prev]);
            });
            stompClient.subscribe(`/topic/kitchen/${storeId}`, (msg) => {
               const order = JSON.parse(msg.body);
               if(order.status === 'PENDING' || order.status === 'PAID') fetchTableMap(); 
               if (selectedTable) updateLocalOrder(order);
            });
          },
        });
        stompClient.activate();
        stompClientRef.current = stompClient;
      }
    }
    return () => { if (stompClientRef.current) stompClientRef.current.deactivate(); };
  }, [token, storeId]); 

  useEffect(() => {
      if (selectedTable && stompClientRef.current?.connected) {
          if (tableSubscriptionRef.current) tableSubscriptionRef.current.unsubscribe();
          const tableTopic = `/topic/table/${selectedTable.id}`;
          tableSubscriptionRef.current = stompClientRef.current.subscribe(tableTopic, (msg) => updateLocalOrder(JSON.parse(msg.body)));
      }
      return () => { if (tableSubscriptionRef.current) tableSubscriptionRef.current.unsubscribe(); };
  }, [selectedTable]);

  const updateLocalOrder = (updatedOrder) => {
      setTableOrders(prevOrders => {
          const exists = prevOrders.find(o => o.id === updatedOrder.id);
          if (exists) return prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
          return [updatedOrder, ...prevOrders];
      });
  };

  // === 3. NGHIỆP VỤ ===
  const handleSelectTable = async (table) => {
    if (!apiClient) return;
    setSelectedTable(table);
    setLoading(true);
    try { setTableOrders((await apiClient.get(`/staff/tables/${table.id}/orders`)).data); } 
    catch (err) { setError(`Lỗi tải đơn hàng.`); } finally { setLoading(false); }
  };
  
  const handleMarkAsPaid = async (orderId) => {
    if (!apiClient) return;
    try {
      const res = await apiClient.post(`/staff/order/${orderId}/pay`);
      updateLocalOrder(res.data); fetchTableMap(); setPaymentModalData(null);
    } catch (err) { alert("Lỗi thanh toán."); }
  };

  const handlePayAll = async (tableId) => {
     if (!apiClient) return;
     try {
         await apiClient.post(`/staff/tables/${tableId}/pay-all`);
         const res = await apiClient.get(`/staff/tables/${tableId}/orders`);
         setTableOrders(res.data);
         fetchTableMap(); 
         setPaymentModalData(null);
     } catch (e) { alert("Lỗi thanh toán tổng hợp."); }
  };
  
  const handleCancelItem = async (itemId) => {
    if (!window.confirm("Hủy món này?")) return;
    try { const res = await apiClient.delete(`/staff/order/item/${itemId}`); updateLocalOrder(res.data); } catch (err) { alert("Lỗi hủy món."); }
  };
  
  const handleSaveSurcharge = async (oid, amt, note) => {
     try { const res = await apiClient.put(`/staff/order/${oid}/surcharge`, { surcharge: amt, surchargeNotes: note }); updateLocalOrder(res.data); setSurchargeModalOrder(null); } catch (e) { alert("Lỗi lưu phụ phí."); }
  };

  const handleUpdateQuantity = async (iid, qty) => {
      if (qty < 1) return; 
      try { const res = await apiClient.put(`/staff/order/item/${iid}/quantity`, { quantity: qty }); updateLocalOrder(res.data); } catch (e) { alert("Lỗi cập nhật SL."); }
  };

  const handleAddItemsToOrder = async (oid, items) => {
      try { const res = await apiClient.post(`/staff/order/${oid}/items`, items); updateLocalOrder(res.data); setAddItemModalOrder(null); } catch (e) { alert("Lỗi thêm món."); }
  };

  const handlePrint = (type, orderOrList, table, isBulk = false) => {
    const isBill = type === 'BILL';
    const date = new Date().toLocaleString('vi-VN');
    let itemsToPrint = [], total = 0, surchargeTotal = 0, orderIds = "";

    if (isBulk) {
        orderOrList.forEach(o => {
            itemsToPrint = [...itemsToPrint, ...o.items];
            total += o.totalPrice + (o.surcharge || 0);
            surchargeTotal += (o.surcharge || 0);
        });
        orderIds = "Gộp (" + orderOrList.length + " đơn)";
    } else {
        itemsToPrint = orderOrList.items;
        total = orderOrList.totalPrice + (orderOrList.surcharge || 0);
        surchargeTotal = orderOrList.surcharge || 0;
        orderIds = "#" + orderOrList.id;
    }

    const content = (
      <div className="p-2 receipt-font text-black text-sm w-full max-w-[300px] mx-auto border-b-2 border-dashed pb-4">
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold uppercase">{isBill ? 'HÓA ĐƠN' : 'PHIẾU BẾP'}</h2>
          <p className="text-xs">{date}</p>
        </div>
        <div className="mb-2 border-b border-dashed pb-1">
          <p>Bàn: <span className="font-bold text-lg">{table.name}</span></p>
          <p>Đơn: {orderIds}</p>
          <p>NV: {token ? JSON.parse(atob(token.split('.')[1])).sub : 'Staff'}</p>
        </div>
        <table className="w-full text-left mb-2">
          <thead><tr className="border-b text-xs"><th className="w-1/2">Tên</th><th className="w-1/4 text-center">SL</th>{isBill && <th className="w-1/4 text-right">Tiền</th>}</tr></thead>
          <tbody>
            {itemsToPrint.map((item, idx) => (
              <tr key={idx} className="border-b border-dotted">
                <td className="py-1 pr-1"><div className={isBill ? "" : "font-bold text-lg"}>{item.menuItemName}</div>{item.note && <div className="text-xs italic">({item.note})</div>}</td>
                <td className={`py-1 text-center ${isBill ? "" : "font-bold text-lg"}`}>{item.quantity}</td>
                {isBill && <td className="py-1 text-right">{formatCurrency(item.priceAtOrder * item.quantity)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {isBill && (
          <div className="mt-2 border-t-2 border-black pt-2">
            {surchargeTotal > 0 && <div className="flex justify-between text-xs mb-1"><span>Phụ phí:</span><span>{formatCurrency(surchargeTotal)}</span></div>}
            <div className="flex justify-between font-bold text-lg mt-2"><span>TỔNG:</span><span>{formatCurrency(total)}</span></div>
            <div className="text-center mt-4 text-xs"><p>Cảm ơn quý khách!</p></div>
          </div>
        )}
      </div>
    );
    setPrintableContent(content);
    setTimeout(() => { window.print(); setPrintableContent(null); }, 500);
  };

  const handleOpenTableModal = (t) => { if(t){alert("Chỉ Admin được sửa."); return;} setEditingTable(null); setIsTableModalOpen(true); };
  const handleSaveTable = async (d) => { try { const res = await apiClient.post('/api/admin/tables', d); fetchTableMap(); setIsTableModalOpen(false); setQrModalTable(res.data); } catch(e){alert("Lỗi lưu bàn.");} };

  if (!token) return <LoginView onLogin={handleLogin} loading={loading} error={error} />;

  return (
    <div className="font-sans antialiased bg-gray-100 min-h-screen p-4 flex flex-col h-screen overflow-hidden">
      <div id="printable-area" className="hidden print:block">{printableContent}</div>

      <header className="mb-4 flex justify-between items-center shrink-0 print:hidden">
        <h1 className="text-3xl font-bold text-gray-800">Sơ đồ Bàn ({storeId})</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => handleOpenTableModal(null)} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">+ Thêm bàn</button>
          <NotificationBell notifications={notifications} onClear={() => setNotifications([])} />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 print:hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tableMap.map(table => (
            <TableCard key={table.id} table={table} onClick={() => handleSelectTable(table)} onShowQr={() => setQrModalTable(table)} />
          ))}
        </div>
      </div>

      {selectedTable && <TableDetailModal table={selectedTable} orders={tableOrders} onClose={() => setSelectedTable(null)} onCancelItem={handleCancelItem} onEditSurcharge={setSurchargeModalOrder} onUpdateQuantity={handleUpdateQuantity} onAddItem={(order) => setAddItemModalOrder(order)} onOpenPayment={(data, type) => setPaymentModalData({ data, type, table: selectedTable })} onPrintKitchen={(order) => handlePrint('KITCHEN', order, selectedTable)} loading={loading} />}
      {paymentModalData && <PaymentModal modalData={paymentModalData} bankConfig={bankConfig || BANK_CONFIG_DEFAULT} onClose={() => setPaymentModalData(null)} onConfirmPaid={paymentModalData.type === 'SINGLE' ? handleMarkAsPaid : () => handlePayAll(paymentModalData.table.id)} onPrintBill={(data) => handlePrint('BILL', data, paymentModalData.table, paymentModalData.type === 'ALL')} />}
      {isTableModalOpen && <TableEditModal table={editingTable} onClose={() => setIsTableModalOpen(false)} onSave={handleSaveTable} loading={loading} />}
      {qrModalTable && <QrCodeModal table={qrModalTable} subdomain={subdomain} onClose={() => setQrModalTable(null)} />}
      {surchargeModalOrder && <SurchargeModal order={surchargeModalOrder} onClose={() => setSurchargeModalOrder(null)} onSave={handleSaveSurcharge} loading={loading} />}
      {addItemModalOrder && <AddItemModal order={addItemModalOrder} menuItems={menuItems} onClose={() => setAddItemModalOrder(null)} onSave={handleAddItemsToOrder} />}
    </div>
  );
}

// --- CÁC COMPONENT CON (Copy giữ nguyên, chỉ cần đảm bảo QrCodeModal dùng đúng URL động) ---

function LoginView({ onLogin, loading, error }) {const [u, setU] = useState('admin'); const [p, setP] = useState('admin'); return (<div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-sm"><h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Đăng nhập Nhân viên</h2><form onSubmit={(e) => {e.preventDefault(); onLogin(u, p)}}><div className="mb-4"><label className="block text-gray-700 mb-2">Tên đăng nhập</label><input type="text" value={u} onChange={(e) => setU(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required /></div><div className="mb-6"><label className="block text-gray-700 mb-2">Mật khẩu</label><input type="password" value={p} onChange={(e) => setP(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required /></div>{error && <p className="text-red-500 text-center mb-4">{error}</p>}<button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button></form></div></div>);}
function TableCard({ table, onClick, onShowQr }) {const isPending = table.status === 'ACTIVE'; return (<div className={`relative aspect-square rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 transition border-2 ${isPending ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-transparent text-gray-600 hover:border-blue-200'}`}><button onClick={onClick} className="w-full h-full flex flex-col items-center justify-center"><h3 className="text-xl font-bold">{table.name}</h3><p className="text-[10px] text-gray-400 font-mono">ID: {table.id}</p><p className="text-xs mt-1">{table.capacity} khách</p><span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isPending ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-500'}`}>{isPending ? 'Có khách' : 'Trống'}</span></button><button onClick={(e) => { e.stopPropagation(); onShowQr(); }} className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition z-10" title="Xem mã QR"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM16.5 19.5h.75v.75h-.75v-.75z" /></svg></button></div>);}
function NotificationBell({ notifications, onClear }) {const [isOpen, setIsOpen] = useState(false); return (<div className="relative"><button onClick={() => setIsOpen(prev => !prev)} className="relative p-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-700"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.017 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>{notifications.length > 0 && (<span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{notifications.length}</span>)}</button>{isOpen && (<div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border z-10"><div className="p-2 border-b flex justify-between items-center"><h4 className="font-semibold">Thông báo</h4><button onClick={() => { onClear(); setIsOpen(false); }} className="text-xs text-blue-500 hover:underline">Xóa tất cả</button></div><div className="max-h-80 overflow-y-auto">{notifications.length === 0 ? (<p className="text-gray-500 text-sm p-4 text-center">Không có gì mới.</p>) : (notifications.map((call, index) => (<div key={index} className="p-3 border-b hover:bg-gray-50"><p className="font-semibold"><span className="text-red-500">Bàn {call.tableName}</span> {call.callType === 'PAYMENT' ? 'gọi thanh toán!' : 'cần phục vụ!'}</p><p className="text-xs text-gray-500">{new Date(call.timestamp).toLocaleTimeString('vi-VN')}</p></div>)))}</div></div>)}</div>);}
function TableEditModal({ table, onClose, onSave, loading }) {const [name, setName] = useState(table?.name || ''); const [capacity, setCapacity] = useState(table?.capacity || 2); return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md"><form onSubmit={(e) => {e.preventDefault(); onSave({name, capacity: parseInt(capacity)})}}><div className="p-4 border-b"><h2 className="text-2xl font-bold">Tạo Bàn mới</h2></div><div className="p-4 flex flex-col gap-4"><div><label className="block text-gray-700 mb-1">Tên Bàn</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required /></div><div><label className="block text-gray-700 mb-1">Sức chứa</label><input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required min="1" /></div></div><div className="p-4 bg-gray-50 border-t rounded-b-lg flex justify-end items-center gap-3"><button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300">Hủy</button><button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Đang lưu...' : 'Lưu'}</button></div></form></div></div>); }

// [CẬP NHẬT] QrCodeModal dùng link động
function QrCodeModal({ table, subdomain, onClose }) {
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

function SurchargeModal({ order, onClose, onSave, loading }) {const [amount, setAmount] = useState(order?.surcharge || 0); const [notes, setNotes] = useState(order?.surchargeNotes || ''); return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md"><form onSubmit={(e) => {e.preventDefault(); onSave(order.id, parseFloat(amount), notes)}}><div className="p-4 border-b"><h2 className="text-2xl font-bold">Phụ phí (Đơn #{order.id})</h2></div><div className="p-4 flex flex-col gap-4"><div><label>Số tiền</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div><div><label>Ghi chú</label><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div></div><div className="p-4 bg-gray-50 border-t rounded-b-lg flex justify-end gap-3"><button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg">Hủy</button><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Lưu</button></div></form></div></div>); }
function AddItemModal({ order, menuItems, onClose, onSave }) {const [localCart, setLocalCart] = useState([]); const addToLocalCart = (item) => setLocalCart(prev => { const exist = prev.find(i => i.id === item.id); return exist ? prev.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i) : [...prev, { ...item, quantity: 1 }]; }); const removeFromLocalCart = (itemId) => setLocalCart(prev => { const exist = prev.find(i => i.id === itemId); return exist.quantity > 1 ? prev.map(i => i.id === itemId ? {...i, quantity: i.quantity - 1} : i) : prev.filter(i => i.id !== itemId); }); return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"><div className="p-4 border-b flex justify-between items-center bg-gray-50"><h2 className="text-xl font-bold text-gray-800">Thêm món vào Đơn #{order.id}</h2><button onClick={onClose} className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300 flex items-center justify-center">✕</button></div><div className="flex-1 overflow-hidden flex flex-col md:flex-row"><div className="md:w-2/3 p-4 overflow-y-auto bg-white"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{menuItems.map(item => (<div key={item.id} className={`border p-3 rounded-lg flex justify-between items-center hover:border-blue-300 transition ${item.isOutOfStock ? 'opacity-50 grayscale' : ''}`}><div><p className="font-bold text-gray-800">{item.name}</p><p className="text-sm text-gray-500">{formatCurrency(item.price)}</p></div><button disabled={item.isOutOfStock} onClick={() => addToLocalCart(item)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-lg hover:bg-blue-600 hover:text-white transition disabled:bg-gray-100 disabled:text-gray-400">+</button></div>))}</div></div><div className="md:w-1/3 p-4 overflow-y-auto bg-gray-50 border-l"><h3 className="font-bold text-gray-700 mb-3">Đã chọn ({localCart.reduce((acc, i) => acc + i.quantity, 0)})</h3>{localCart.length === 0 && <p className="text-gray-400 text-sm text-center py-10">Chưa chọn món nào.</p>}<div className="flex flex-col gap-2">{localCart.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border"><span className="text-sm font-medium text-gray-800 truncate flex-1">{item.name}</span><div className="flex items-center gap-2 ml-2"><button onClick={() => removeFromLocalCart(item.id)} className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 font-bold text-gray-600">-</button><span className="text-sm w-4 text-center font-bold">{item.quantity}</span><button onClick={() => addToLocalCart(item)} className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 font-bold text-gray-600">+</button></div></div>))}</div></div></div><div className="p-4 border-t bg-white flex justify-end gap-3"><button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button><button onClick={() => { const itemsDto = localCart.map(i => ({ menuItemId: i.id, quantity: i.quantity })); onSave(order.id, itemsDto); }} disabled={localCart.length === 0} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500">Xác nhận thêm</button></div></div></div>); }
function StatusBadge({ status }) { const map = { PENDING: 'bg-yellow-200 text-yellow-800', PREPARING: 'bg-blue-200 text-blue-800', COMPLETED: 'bg-green-200 text-green-800', SERVED: 'bg-green-300 text-green-900', PAID: 'bg-gray-300 text-gray-900', CANCELLED: 'bg-red-200 text-red-800' }; return <span className={`px-2 py-1 rounded-full font-semibold text-xs ${map[status] || ''}`}>{status}</span>; }
function TableDetailModal({ table, orders, onClose, onOpenPayment, onPrintKitchen, onCancelItem, onEditSurcharge, onUpdateQuantity, onAddItem, loading }) {
  const activeOrders = orders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED');
  const paidOrders = orders.filter(o => o.status === 'PAID');
  const grandTotal = useMemo(() => activeOrders.reduce((sum, order) => sum + order.totalPrice + (order.surcharge || 0), 0), [activeOrders]);
  return (<div className="fixed inset-0 z-40 flex justify-end print:hidden"><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div><div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-left"><div className="p-4 border-b bg-gray-50 flex justify-between items-center"><div><h2 className="text-xl font-bold text-gray-800">{table.name}</h2><p className="text-xs text-gray-500">Chi tiết đơn hàng</p></div><button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300">✕</button></div><div className="flex-1 overflow-y-auto p-4 bg-gray-100 space-y-4">{loading && <p className="text-center text-gray-500">Đang tải...</p>}{activeOrders.map(order => (<OrderDetailCard key={order.id} order={order} onOpenPayment={onOpenPayment} onPrintKitchen={onPrintKitchen} onCancelItem={onCancelItem} onEditSurcharge={onEditSurcharge} onUpdateQuantity={onUpdateQuantity} onAddItem={() => onAddItem(order)} />))}{paidOrders.length > 0 && (<details className="group"><summary className="list-none flex justify-between items-center cursor-pointer bg-white p-3 rounded-lg shadow-sm text-gray-500 font-semibold select-none mt-4"><span>Lịch sử đã thanh toán ({paidOrders.length})</span><span className="group-open:rotate-180 transition">▼</span></summary><div className="mt-3 space-y-3">{paidOrders.map(order => <OrderDetailCard key={order.id} order={order} />)}</div></details>)}</div><div className="p-4 border-t bg-white shadow-lg z-10"><div className="flex justify-between items-center mb-3"><span className="text-gray-600 font-medium">Tạm tính (Chưa TT):</span><span className="text-2xl font-bold text-blue-600">{formatCurrency(grandTotal)}</span></div><div className="grid grid-cols-2 gap-3"><button onClick={onClose} className="bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300">Đóng</button><button disabled={activeOrders.length === 0} onClick={() => onOpenPayment(activeOrders, 'ALL')} className="bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-md disabled:bg-gray-300">Thanh toán Hết ({activeOrders.length})</button></div></div></div></div>);
}
function OrderDetailCard({ order, onOpenPayment, onPrintKitchen, onCancelItem, onEditSurcharge, onUpdateQuantity, onAddItem }) {
  const totalWithSurcharge = order.totalPrice + (order.surcharge || 0); const canEdit = order.status !== 'PAID' && order.status !== 'CANCELLED';
  return (<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b border-gray-100"><span className="font-bold text-gray-700 text-sm">Đơn #{order.id}</span><StatusBadge status={order.status} /></div><div className="p-4"><ul className="space-y-3 mb-4">{order.items.map(item => (<li key={item.id} className="flex justify-between items-start text-sm"><div className="flex items-center gap-2">{canEdit && onUpdateQuantity ? (<div className="flex items-center border rounded-lg bg-gray-50 h-7 shadow-sm"><button className="px-2 hover:bg-gray-200 rounded-l-lg text-red-500 font-bold" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>-</button><span className="px-1 min-w-[20px] text-center font-medium text-gray-700">{item.quantity}</span><button className="px-2 hover:bg-gray-200 rounded-r-lg text-green-600 font-bold" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>+</button></div>) : <span className="font-bold">{item.quantity}x</span>}<div className="flex flex-col"><span className="text-gray-800 ml-1 font-medium">{item.menuItemName}</span>{item.note && <span className="text-xs text-orange-600 italic bg-orange-50 px-2 py-0.5 rounded w-fit mt-1">📝 {item.note}</span>}</div></div><div className="flex flex-col items-end"><span className="text-gray-600">{formatCurrency(item.priceAtOrder * item.quantity)}</span>{canEdit && onCancelItem && order.status === 'PENDING' && <button onClick={() => onCancelItem(item.id)} className="text-xs text-red-500 hover:underline mt-1">Hủy</button>}</div></li>))}{order.surcharge > 0 && <li className="flex justify-between text-sm text-blue-600 font-medium pt-2 border-t border-dashed border-gray-200"><span>Phụ phí {order.surchargeNotes && <span className="text-gray-400 text-xs italic font-normal ml-1">({order.surchargeNotes})</span>}</span><span>{formatCurrency(order.surcharge)}</span></li>}</ul><div className="border-t pt-3"><div className="flex justify-between items-center mb-3"><span className="font-bold text-lg text-gray-800">{formatCurrency(totalWithSurcharge)}</span></div><div className="grid grid-cols-2 gap-2">{canEdit && (<>{onAddItem && <button onClick={onAddItem} className="bg-blue-50 text-blue-600 px-2 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-100">+ Món</button>}{onEditSurcharge && <button onClick={() => onEditSurcharge(order)} className="bg-gray-50 text-gray-600 px-2 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 border border-gray-200">Phụ phí</button>}</>)}{onPrintKitchen && <button onClick={() => onPrintKitchen(order)} className="bg-yellow-50 text-yellow-700 px-2 py-2 rounded-lg text-xs font-bold hover:bg-yellow-100 border border-yellow-200">🖨️ In Bếp</button>}{onOpenPayment && order.status !== 'PAID' && (<button onClick={() => onOpenPayment(order, 'SINGLE')} className="bg-green-600 text-white px-2 py-2 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm col-span-2">Thanh toán / In Bill</button>)}</div></div></div></div>);
}
function PaymentModal({ modalData, bankConfig, onClose, onConfirmPaid, onPrintBill }) {
  const { data, type, table } = modalData; let total = 0; let contentText = ""; if (type === 'SINGLE') { total = data.totalPrice + (data.surcharge || 0); contentText = `Đơn #${data.id}`; } else { total = data.reduce((sum, order) => sum + order.totalPrice + (order.surcharge || 0), 0); contentText = `Tất cả (${data.length} đơn)`; }
  let qrUrl = null; if (bankConfig && bankConfig.bankId && bankConfig.accountNo) { const addInfo = `BAN ${table.name} ${type === 'SINGLE' ? 'DON '+data.id : 'THANH TOAN'}`; qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-${bankConfig.qrTemplate || 'compact'}.png?amount=${total}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(bankConfig.accountName)}`; }
  return (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"><div className="bg-green-600 p-4 text-white flex justify-between items-center"><h2 className="text-xl font-bold">Thanh toán: {formatCurrency(total)}</h2><button onClick={onClose} className="text-white hover:bg-green-700 rounded-full w-8 h-8 flex items-center justify-center">✕</button></div><div className="p-6 flex-1 overflow-y-auto flex flex-col items-center"><p className="text-gray-600 mb-4 text-center">Quét mã để thanh toán cho <br/><strong>Bàn {table.name} - {contentText}</strong></p><div className="bg-white p-2 border-2 border-green-100 rounded-xl shadow-sm mb-6">{qrUrl ? <img src={qrUrl} alt="VietQR" className="w-64 h-64 object-contain" /> : <div className="w-64 h-64 flex items-center justify-center bg-gray-100 text-gray-500 text-center p-4">Chưa cấu hình ngân hàng.<br/>Vui lòng liên hệ Admin.</div>}</div><div className="grid grid-cols-2 gap-3 w-full"><button onClick={() => onPrintBill(data)} className="flex items-center justify-center gap-2 bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition">🖨️ In Hóa Đơn</button><button onClick={() => onConfirmPaid(type === 'SINGLE' ? data.id : null)} className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg transition">✅ Đã thu tiền</button></div></div></div></div>);
}
