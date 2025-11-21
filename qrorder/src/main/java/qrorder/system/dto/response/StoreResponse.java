package qrorder.system.dto.response;

public record StoreResponse(
        Long id,
        String name,
        String subdomain,
        String bankId,
        String accountNo
) {}