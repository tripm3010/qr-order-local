package qrorder.system.dto.request;

import java.util.List;

// 2. DTO đơn hàng (gửi lên)
public record OrderPlacementRequest(
        String tableAccessKey, // KEY TABLE
        List<OrderItemRequest> items
) {}