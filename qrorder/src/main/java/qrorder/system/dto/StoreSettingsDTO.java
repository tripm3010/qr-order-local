package qrorder.system.dto;

public record StoreSettingsDTO(
        String bankId,
        String accountNo,
        String accountName,
        String qrTemplate
) {}