package qrorder.system.dto.request;

// 1. DTO món hàng trong giỏ (gửi lên)
public record OrderItemRequest(
        Long menuItemId,
        int quantity,
        String note
) {}