package qrorder.system.dto.response;

import java.math.BigDecimal;

// Dùng cho response
public record MenuItemResponse(
        Long id,
        String name,
        String description,
        BigDecimal price,
        String imageUrl,
        Long categoryId,
        String categoryName, // Thêm tên category cho dễ hiển thị
        Long storeId,
        Boolean isOutOfStock // Thêm trạng thái hết hàng
) {}