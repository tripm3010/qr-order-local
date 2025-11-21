package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.request.UpdateOrderStatusRequest;
import qrorder.system.dto.response.OrderResponse;
import qrorder.system.service.OrderService;

import java.util.List;

@RestController
@RequestMapping("/api/kitchen")
// Chỉ ADMIN hoặc KITCHEN mới được truy cập
@PreAuthorize("hasAnyRole('ADMIN', 'KITCHEN')")
public class KitchenController {

    @Autowired
    private OrderService orderService;

    /**
     * API cho Bếp cập nhật trạng thái đơn hàng
     * (VD: PENDING -> PREPARING, PREPARING -> READY)
     * POST /api/kitchen/order/{orderId}/status
     */
    @PostMapping("/order/{orderId}/status")
    public ResponseEntity<OrderResponse> updateStatus(
            @PathVariable Long orderId,
            @RequestBody UpdateOrderStatusRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        OrderResponse updatedOrder = orderService.updateOrderStatus(orderId, request, userDetails);
        return ResponseEntity.ok(updatedOrder);
    }

    /**
     * [MỚI] API cho Bếp lấy danh sách các đơn hàng đang hoạt động
     * (PENDING, PREPARING) khi Bếp vừa mở.
     * GET /api/kitchen/orders
     */
    @GetMapping("/orders")
    public ResponseEntity<List<OrderResponse>> getActiveOrders(
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        List<OrderResponse> activeOrders = orderService.getKitchenActiveOrders(userDetails);
        return ResponseEntity.ok(activeOrders);
    }
}