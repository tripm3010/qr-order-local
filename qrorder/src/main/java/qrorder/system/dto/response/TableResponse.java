package qrorder.system.dto.response;

// Dùng cho response
public record TableResponse(
        Long id,
        String name,
        int capacity,
        Long storeId,
        // Tương lai có thể thêm: String qrCodeUrl (hệ thống tự generate)
        // [MỚI] Trả về mã bí mật (UUID) để tạo QR Code an toàn
        String accessKey
) {}