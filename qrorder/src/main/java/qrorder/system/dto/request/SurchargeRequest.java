package qrorder.system.dto.request;

import java.math.BigDecimal;

/**
 * DTO để Staff gửi yêu cầu cập nhật phụ phí
 */
public record SurchargeRequest(
        BigDecimal surcharge, // Số tiền phụ phí mới
        String surchargeNotes // Ghi chú (VD: "Phí vỡ ly", "Khăn lạnh")
) {}