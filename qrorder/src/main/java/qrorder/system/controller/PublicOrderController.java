package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import qrorder.system.dto.request.OrderPlacementRequest;
import qrorder.system.dto.response.OrderResponse;
import qrorder.system.dto.response.TableResponse;
import qrorder.system.entity.TableInfo;
import qrorder.system.repository.TableRepository;
import qrorder.system.service.OrderService;

import java.util.List;

@RestController
@RequestMapping("/api/public") // [CẬP NHẬT] Đổi đường dẫn gốc
public class PublicOrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private TableRepository tableRepository;

    /**
     * API Khách hàng gửi đơn hàng
     * POST /api/public/order
     */
    @PostMapping("/order")
    public ResponseEntity<OrderResponse> placeOrder(@RequestBody OrderPlacementRequest request) {
        OrderResponse response = orderService.placeOrder(request);
        return ResponseEntity.ok(response);
    }

    /**
     * API Khách hàng/Nhân viên xem lại đơn hàng
     * GET /api/public/order/{id}
     */
    @GetMapping("/order/{id}")
    public ResponseEntity<OrderResponse> getOrderDetails(@PathVariable Long id) {
        OrderResponse response = orderService.getOrderDetails(id);
        return ResponseEntity.ok(response);
    }

    /**
     * [MỚI] API Khách hàng tải các đơn hàng đang hoạt động
     * của bàn khi vừa quét QR
     * GET /api/public/tables/{tableId}/orders
     */
    @GetMapping("/tables/{tableAccessKey}/orders")
    public ResponseEntity<List<OrderResponse>> getActiveOrdersForTable(
            @PathVariable String tableAccessKey) {

        List<OrderResponse> orders = orderService.getPublicActiveOrdersForTable(tableAccessKey);
        return ResponseEntity.ok(orders);
    }
    /**
     * [MỚI] API lấy thông tin bàn từ Access Key
     * (Để frontend biết ID bàn mà subscribe WebSocket)
     * GET /api/public/tables/{accessKey}/info
     */
    @GetMapping("/tables/{accessKey}/info")
    public ResponseEntity<TableResponse> getTableInfo(@PathVariable String accessKey) {
        TableInfo table = tableRepository.findByAccessKey(accessKey)
                .orElseThrow(() -> new RuntimeException("Mã bàn không hợp lệ"));

        // Trả về thông tin bàn (bao gồm ID)
        return ResponseEntity.ok(new TableResponse(
                table.getId(), table.getName(), table.getCapacity(), table.getStore().getId(), table.getAccessKey()
        ));
    }
}