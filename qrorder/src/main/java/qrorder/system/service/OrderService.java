package qrorder.system.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.config.tenant.TenantContext;
import qrorder.system.dto.request.OrderItemRequest;
import qrorder.system.dto.request.OrderPlacementRequest;
import qrorder.system.dto.request.SurchargeRequest;
import qrorder.system.dto.request.UpdateOrderStatusRequest;
import qrorder.system.dto.response.OrderItemResponse;
import qrorder.system.dto.response.OrderResponse;
import qrorder.system.entity.CustomerOrder;
import qrorder.system.entity.MenuItem;
import qrorder.system.entity.OrderItem;
import qrorder.system.entity.TableInfo;
import qrorder.system.enums.OrderStatus;
import qrorder.system.repository.CustomerOrderRepository;
import qrorder.system.repository.MenuItemRepository;
import qrorder.system.repository.OrderItemRepository;
import qrorder.system.repository.TableRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    @Autowired
    private CustomerOrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private TableRepository tableRepository;

    @Autowired
    private MenuItemRepository menuItemRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // Dùng để gửi WebSocket

    // Danh sách các trạng thái đơn hàng Bếp cần xem
    private static final List<OrderStatus> KITCHEN_ACTIVE_STATUSES = Arrays.asList(
            OrderStatus.PENDING,
            OrderStatus.PREPARING
    );

    // Danh sách các trạng thái Khách hàng/Nhân viên coi là "đang hoạt động"
    private static final List<OrderStatus> CUSTOMER_ACTIVE_STATUSES = Arrays.asList(
            OrderStatus.PENDING,
            OrderStatus.PREPARING,
            OrderStatus.COMPLETED,
            OrderStatus.SERVED
    );

    /**
     * Khách hàng đặt hàng (Sử dụng Access Key để bảo mật)
     */
    @Transactional
    public OrderResponse placeOrder(OrderPlacementRequest request) {
        Long storeId = TenantContext.getTenantId();
        if (storeId == null) {
            throw new RuntimeException("Không thể xác định chi nhánh");
        }

        // [QUAN TRỌNG] Tìm bàn bằng Access Key thay vì ID
        TableInfo table = tableRepository.findByAccessKey(request.tableAccessKey())
                .orElseThrow(() -> new RuntimeException("Mã bàn không hợp lệ hoặc bàn không tồn tại"));

        // Bảo mật: Đảm bảo Bàn này thuộc chi nhánh (store) hiện tại
        if (!table.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Bàn không hợp lệ cho chi nhánh này");
        }

        CustomerOrder newOrder = new CustomerOrder();
        newOrder.setTable(table);
        newOrder.setStore(table.getStore());
        newOrder.setStatus(OrderStatus.PENDING); // Trạng thái đầu tiên
        newOrder.setCreatedAt(LocalDateTime.now());
        newOrder.setSurcharge(BigDecimal.ZERO);

        // Lưu trước để có ID
        CustomerOrder savedOrder = orderRepository.save(newOrder);

        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (OrderItemRequest itemRequest : request.items()) {
            MenuItem menuItem = menuItemRepository.findByIdAndStoreId(itemRequest.menuItemId(), storeId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy Món ID: " + itemRequest.menuItemId()));

            if (menuItem.isOutOfStock()) {
                throw new RuntimeException("Món '" + menuItem.getName() + "' đã hết hàng.");
            }

            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(savedOrder);
            orderItem.setMenuItem(menuItem);
            orderItem.setQuantity(itemRequest.quantity());
            orderItem.setPricePerItem(menuItem.getPrice());
            orderItem.setNote(itemRequest.note()); // Lưu ghi chú

            orderItems.add(orderItem);
            total = total.add(menuItem.getPrice().multiply(BigDecimal.valueOf(itemRequest.quantity())));
        }

        orderItemRepository.saveAll(orderItems);

        // Cập nhật tổng tiền vào DB
        savedOrder.setTotalPrice(total);
        orderRepository.save(savedOrder);

        // Gửi WebSocket
        OrderResponse response = toOrderResponse(savedOrder, orderItems);
        String kitchenTopic = "/topic/kitchen/" + storeId;
        String tableTopic = "/topic/table/" + savedOrder.getTable().getId();

        System.out.println("Đang gửi đơn hàng mới đến Bếp: " + kitchenTopic);
        messagingTemplate.convertAndSend(kitchenTopic, response);
        messagingTemplate.convertAndSend(tableTopic, response);

        return response;
    }

    /**
     * Khách hàng/Nhân viên xem chi tiết đơn hàng (Public)
     */
    @Transactional(readOnly = true)
    public OrderResponse getOrderDetails(Long orderId) {
        Long storeId = TenantContext.getTenantId();
        if (storeId == null) throw new RuntimeException("Không thể xác định chi nhánh");

        CustomerOrder order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy đơn hàng"));

        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);

        return toOrderResponse(order, items);
    }

    /**
     * Khách hàng xem các đơn hàng đang hoạt động của bàn (Sử dụng Access Key)
     */
    @Transactional(readOnly = true)
    public List<OrderResponse> getPublicActiveOrdersForTable(String tableAccessKey) {
        Long storeId = TenantContext.getTenantId();
        if (storeId == null) throw new RuntimeException("Không thể xác định chi nhánh");

        // 1. Tìm bàn bằng Key
        TableInfo table = tableRepository.findByAccessKey(tableAccessKey)
                .orElseThrow(() -> new RuntimeException("Mã bàn không hợp lệ"));

        if (!table.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Bàn không thuộc chi nhánh này");
        }

        // 2. Lấy đơn hàng bằng ID bàn (tìm được từ Key)
        List<CustomerOrder> orders = orderRepository.findAllByTableAndStoreIdAndStatusIn(
                table, storeId, CUSTOMER_ACTIVE_STATUSES
        );

        return orders.stream()
                .map(order -> {
                    List<OrderItem> items = orderItemRepository.findByOrder_Id(order.getId());
                    return toOrderResponse(order, items);
                })
                .collect(Collectors.toList());
    }

    /**
     * Bếp (Kitchen) cập nhật trạng thái đơn hàng
     */
    @Transactional
    public OrderResponse updateOrderStatus(Long orderId, UpdateOrderStatusRequest request, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        CustomerOrder order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy đơn hàng"));

        order.setStatus(request.newStatus());
        CustomerOrder updatedOrder = orderRepository.save(order);

        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
        OrderResponse response = toOrderResponse(updatedOrder, items);

        messagingTemplate.convertAndSend("/topic/table/" + order.getTable().getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);

        return response;
    }

    /**
     * Bếp (Kitchen) lấy các đơn hàng đang hoạt động
     */
    @Transactional(readOnly = true)
    public List<OrderResponse> getKitchenActiveOrders(StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        List<CustomerOrder> activeOrders = orderRepository.findAllByStoreIdAndStatusIn(storeId, KITCHEN_ACTIVE_STATUSES);

        return activeOrders.stream()
                .map(order -> {
                    List<OrderItem> items = orderItemRepository.findByOrder_Id(order.getId());
                    return toOrderResponse(order, items);
                })
                .collect(Collectors.toList());
    }

    /**
     * Nhân viên (Staff) đánh dấu đơn hàng LẺ là ĐÃ THANH TOÁN
     */
    @Transactional
    public OrderResponse markOrderAsPaid(Long orderId, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        CustomerOrder order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy đơn hàng"));

        order.setStatus(OrderStatus.PAID);
        CustomerOrder paidOrder = orderRepository.save(order);

        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);
        OrderResponse response = toOrderResponse(paidOrder, items);

        messagingTemplate.convertAndSend("/topic/table/" + paidOrder.getTable().getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);

        return response;
    }

    /**
     * [MỚI] Nhân viên Thanh toán GỘP toàn bộ đơn hàng đang hoạt động của bàn
     */
    @Transactional
    public void markTableOrdersAsPaid(Long tableId, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();
        TableInfo table = tableRepository.findById(tableId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Table: " + tableId));
        // Lấy các đơn hàng chưa thanh toán của bàn (PENDING, PREPARING, COMPLETED, SERVED)
        List<CustomerOrder> orders = orderRepository.findAllByTableAndStoreIdAndStatusIn(
                table, storeId,
                Arrays.asList(OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.COMPLETED, OrderStatus.SERVED)
        );

        if (orders.isEmpty()) {
            throw new RuntimeException("Không có đơn hàng nào để thanh toán.");
        }

        for (CustomerOrder order : orders) {
            order.setStatus(OrderStatus.PAID);
            // orderRepository.save(order); // JPA sẽ tự động lưu khi kết thúc transaction

            // Gửi WebSocket cập nhật cho từng đơn để client (Khách/Bếp) biết
            List<OrderItem> items = orderItemRepository.findByOrder_Id(order.getId());
            OrderResponse response = toOrderResponse(order, items);

            messagingTemplate.convertAndSend("/topic/table/" + tableId, response);
            messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);
        }

        // Lưu tất cả
        orderRepository.saveAll(orders);
    }

    /**
     * Nhân viên (Staff) xem tất cả đơn hàng của 1 Bàn
     */
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersForTable(Long tableId, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();
        TableInfo table = tableRepository.findById(tableId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Table: " + tableId));

        List<CustomerOrder> orders = orderRepository.findAllByTableAndStoreId(table, storeId);

        return orders.stream()
                .map(order -> {
                    List<OrderItem> items = orderItemRepository.findByOrder_Id(order.getId());
                    return toOrderResponse(order, items);
                })
                .collect(Collectors.toList());
    }

    /**
     * Nhân viên HỦY một món ăn (OrderItem)
     */
    @Transactional
    public OrderResponse cancelOrderItem(Long orderItemId, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        OrderItem itemToDelete = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy món ăn"));

        CustomerOrder order = itemToDelete.getOrder();
        if (!order.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Bạn không có quyền chỉnh sửa đơn hàng này");
        }

        // Chỉ cho phép hủy khi PENDING hoặc PREPARING (hoặc tùy chính sách)
        if (order.getStatus() != OrderStatus.PENDING && order.getStatus() != OrderStatus.PREPARING) {
            throw new RuntimeException("Không thể hủy món khi đơn hàng đã Hoàn thành hoặc Đã phục vụ.");
        }

        orderItemRepository.delete(itemToDelete);

        // Tính lại tổng tiền
        List<OrderItem> remainingItems = orderItemRepository.findByOrder_Id(order.getId());
        BigDecimal newTotal = remainingItems.stream()
                .map(i -> i.getPricePerItem().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setTotalPrice(newTotal);

        if (remainingItems.isEmpty()) {
            order.setStatus(OrderStatus.CANCELLED);
        }

        CustomerOrder savedOrder = orderRepository.save(order);

        OrderResponse response = toOrderResponse(savedOrder, remainingItems);
        messagingTemplate.convertAndSend("/topic/table/" + order.getTable().getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);

        return response;
    }

    /**
     * Nhân viên Cập nhật Phụ phí
     */
    @Transactional
    public OrderResponse updateSurcharge(Long orderId, SurchargeRequest request, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        CustomerOrder order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy đơn hàng"));

        order.setSurcharge(request.surcharge() != null ? request.surcharge() : BigDecimal.ZERO);
        order.setSurchargeNotes(request.surchargeNotes());

        CustomerOrder savedOrder = orderRepository.save(order);
        List<OrderItem> items = orderItemRepository.findByOrder_Id(orderId);

        OrderResponse response = toOrderResponse(savedOrder, items);
        messagingTemplate.convertAndSend("/topic/table/" + order.getTable().getId(), response);

        return response;
    }

    /**
     * [MỚI] Nhân viên Cập nhật số lượng món
     */
    @Transactional
    public OrderResponse updateOrderItemQuantity(Long orderItemId, int newQuantity, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        OrderItem orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy món"));

        CustomerOrder order = orderItem.getOrder();
        if (!order.getStore().getId().equals(storeId)) {
            throw new AccessDeniedException("Không có quyền chỉnh sửa");
        }

        orderItem.setQuantity(newQuantity);
        orderItemRepository.save(orderItem);

        // Tính lại tổng tiền đơn hàng
        List<OrderItem> allItems = orderItemRepository.findByOrder_Id(order.getId());
        BigDecimal newTotal = allItems.stream()
                .map(i -> i.getPricePerItem().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setTotalPrice(newTotal);
        CustomerOrder savedOrder = orderRepository.save(order);

        // Gửi WebSocket update
        OrderResponse response = toOrderResponse(savedOrder, allItems);
        messagingTemplate.convertAndSend("/topic/table/" + order.getTable().getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);

        return response;
    }

    /**
     * [MỚI] Nhân viên Thêm món vào đơn hàng có sẵn
     */
    @Transactional
    public OrderResponse addItemsToOrder(Long orderId, List<OrderItemRequest> newItems, StoreUserDetails userDetails) {
        Long storeId = userDetails.getStoreId();

        CustomerOrder order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy đơn hàng"));

        List<OrderItem> currentItems = orderItemRepository.findByOrder_Id(orderId);
        BigDecimal additionalTotal = BigDecimal.ZERO;

        for (OrderItemRequest req : newItems) {
            MenuItem menuItem = menuItemRepository.findByIdAndStoreId(req.menuItemId(), storeId)
                    .orElseThrow(() -> new RuntimeException("Món không tồn tại"));

            if (menuItem.isOutOfStock()) {
                throw new RuntimeException("Món " + menuItem.getName() + " đã hết hàng.");
            }

            // Tạo món mới
            OrderItem newItem = new OrderItem();
            newItem.setOrder(order);
            newItem.setMenuItem(menuItem);
            newItem.setQuantity(req.quantity());
            newItem.setPricePerItem(menuItem.getPrice());
            newItem.setNote(req.note()); // Lưu ghi chú

            orderItemRepository.save(newItem);
            currentItems.add(newItem);

            additionalTotal = additionalTotal.add(menuItem.getPrice().multiply(BigDecimal.valueOf(req.quantity())));
        }

        // Cập nhật tổng tiền
        order.setTotalPrice(order.getTotalPrice().add(additionalTotal));
        CustomerOrder savedOrder = orderRepository.save(order);

        // Gửi WebSocket
        OrderResponse response = toOrderResponse(savedOrder, currentItems);
        messagingTemplate.convertAndSend("/topic/table/" + order.getTable().getId(), response);
        messagingTemplate.convertAndSend("/topic/kitchen/" + storeId, response);

        return response;
    }

    /**
     * Hàm Helper: Chuyển Entity sang DTO
     */
    private OrderResponse toOrderResponse(CustomerOrder order, List<OrderItem> items) {
        // Tính tổng tiền từ danh sách items (vì CSDL không lưu)
        BigDecimal itemTotal = items.stream()
                .map(item -> item.getPricePerItem().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<OrderItemResponse> itemResponses = items.stream()
                .map(item -> new OrderItemResponse(
                        item.getId(), // [MỚI] Thêm ID để Staff có thể tham chiếu khi sửa/xóa
                        item.getMenuItem().getId(),
                        item.getMenuItem().getName(),
                        item.getQuantity(),
                        item.getNote(),
                        item.getPricePerItem()
                ))
                .collect(Collectors.toList());

        return new OrderResponse(
                order.getId(),
                order.getTable().getId(),
                order.getTable().getName(),
                order.getStore().getId(),
                order.getStatus(),
                itemTotal,
                order.getCreatedAt(),
                itemResponses,
                order.getSurcharge() != null ? order.getSurcharge() : BigDecimal.ZERO,
                order.getSurchargeNotes()
        );
    }
}