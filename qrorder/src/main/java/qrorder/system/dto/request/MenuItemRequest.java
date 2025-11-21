package qrorder.system.dto.request;

import java.math.BigDecimal;

// Dùng cho request tạo mới hoặc cập nhật
public record MenuItemRequest(
        String name,
        String description,
        BigDecimal price,
        String imageUrl,
        Long categoryId, // ID của Category mà món này thuộc về
        Boolean isOutOfStock // Thêm trạng thái hết hàng
) {}