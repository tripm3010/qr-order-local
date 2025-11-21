package qrorder.system.dto.response;

import qrorder.system.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

// 4. DTO đơn hàng (trả về)
public record OrderResponse(
        Long id,
        Long tableId,
        String tableName,
        Long storeId,
        OrderStatus status,
        BigDecimal totalPrice,
        LocalDateTime createdAt,
        List<OrderItemResponse> items,
        // [MỚI] Thêm phụ phí
        BigDecimal surcharge, // Tiền phụ phí
        String surchargeNotes // Ghi chú phụ phí
) {}