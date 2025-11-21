package qrorder.system.dto.request;

import qrorder.system.enums.OrderStatus;

public record UpdateOrderStatusRequest(
        OrderStatus newStatus // Trạng thái mới
) {}