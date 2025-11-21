package qrorder.system.dto.request;

public record UserCreateRequest(
        String username,
        String password, // Mật khẩu plaintext
        String role // "ADMIN", "STAFF", "KITCHEN"
) {}