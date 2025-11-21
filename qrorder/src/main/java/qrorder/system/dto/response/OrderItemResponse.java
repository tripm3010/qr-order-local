package qrorder.system.dto.response;

import java.math.BigDecimal;

// 3. DTO chi tiết món (trả về)
public record OrderItemResponse(
        Long id,
        Long menuItemId,
        String menuItemName,
        int quantity,
        String note,
        BigDecimal priceAtOrder // Giá tại thời điểm đặt
) {}