package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.TableStatusDTO;
import qrorder.system.dto.request.OrderItemRequest;
import qrorder.system.dto.request.SurchargeRequest;
import qrorder.system.dto.response.OrderResponse;
import qrorder.system.service.OrderService;
import qrorder.system.service.TableService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff")
// Chỉ ADMIN hoặc STAFF mới được truy cập
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
public class StaffController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private TableService tableService;

    /**
     * API cho Nhân viên đánh dấu đơn hàng là ĐÃ THANH TOÁN
     * POST /api/staff/order/{orderId}/pay
     */
    @PostMapping("/order/{orderId}/pay")
    public ResponseEntity<OrderResponse> markOrderAsPaid(
            @PathVariable Long orderId,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        OrderResponse paidOrder = orderService.markOrderAsPaid(orderId, userDetails);
        return ResponseEntity.ok(paidOrder);
    }

    /**
     * API cho Nhân viên xem Sơ đồ Bàn (trạng thái các bàn)
     * GET /api/staff/tables
     */
    @GetMapping("/tables")
    public ResponseEntity<List<TableStatusDTO>> getTableMap(
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        List<TableStatusDTO> tableStatuses = tableService.getTableStatusesForStore(userDetails);
        return ResponseEntity.ok(tableStatuses);
    }


    /**
     * API cho Nhân viên xem tất cả đơn hàng của một bàn cụ thể
     * GET /api/staff/tables/{tableId}/orders
     */
    @GetMapping("/tables/{tableId}/orders")
    public ResponseEntity<List<OrderResponse>> getOrdersForTable(
            @PathVariable Long tableId,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        List<OrderResponse> orders = orderService.getOrdersForTable(tableId, userDetails);
        return ResponseEntity.ok(orders);
    }

    /**
     * [MỚI] API cho Nhân viên HỦY một món (OrderItem)
     * (Chỉ áp dụng cho các món đang PENDING)
     * DELETE /api/staff/order/item/{orderItemId}
     */
    @DeleteMapping("/order/item/{orderItemId}")
    public ResponseEntity<OrderResponse> cancelOrderItem(
            @PathVariable Long orderItemId,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        OrderResponse updatedOrder = orderService.cancelOrderItem(orderItemId, userDetails);
        return ResponseEntity.ok(updatedOrder);
    }

    /**
     * [MỚI] API cho Nhân viên thêm/cập nhật PHỤ PHÍ
     * PUT /api/staff/order/{orderId}/surcharge
     */
    @PutMapping("/order/{orderId}/surcharge")
    public ResponseEntity<OrderResponse> updateSurcharge(
            @PathVariable Long orderId,
            @RequestBody SurchargeRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        OrderResponse updatedOrder = orderService.updateSurcharge(orderId, request, userDetails);
        return ResponseEntity.ok(updatedOrder);
    }

    /**
     * [MỚI] Cập nhật số lượng món
     * PUT /api/staff/order/item/{orderItemId}/quantity
     * Body: { "quantity": 5 }
     */
    @PutMapping("/order/item/{orderItemId}/quantity")
    public ResponseEntity<OrderResponse> updateOrderItemQuantity(
            @PathVariable Long orderItemId,
            @RequestBody Map<String, Integer> payload,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        int quantity = payload.get("quantity");
        OrderResponse updatedOrder = orderService.updateOrderItemQuantity(orderItemId, quantity, userDetails);
        return ResponseEntity.ok(updatedOrder);
    }

    /**
     * [MỚI] Thêm món vào đơn hàng có sẵn
     * POST /api/staff/order/{orderId}/items
     */
    @PostMapping("/order/{orderId}/items")
    public ResponseEntity<OrderResponse> addItemsToOrder(
            @PathVariable Long orderId,
            @RequestBody List<OrderItemRequest> newItems,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        OrderResponse updatedOrder = orderService.addItemsToOrder(orderId, newItems, userDetails);
        return ResponseEntity.ok(updatedOrder);
    }
    /**
     * [MỚI] API Thanh toán gộp cho cả bàn
     * POST /api/staff/tables/{tableId}/pay-all
     */
    @PostMapping("/tables/{tableId}/pay-all")
    public ResponseEntity<?> markTableAsPaid(
            @PathVariable Long tableId,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        orderService.markTableOrdersAsPaid(tableId, userDetails);
        return ResponseEntity.ok().build();
    }
}