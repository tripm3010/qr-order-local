package qrorder.system.dto;

import qrorder.system.enums.TableStatus;

/**
 * DTO trả về cho Nhân viên xem Sơ đồ Bàn (Table Map)
 * @param id ID của bàn
 * @param name Tên bàn (ví dụ: "A1", "Tầng 2 - Bàn 05")
 * @param capacity Sức chứa
 * @param status Trạng thái hiện tại (EMPTY, ACTIVE)
 */
public record TableStatusDTO(
        Long id,
        String name,
        int capacity,
        TableStatus status,
        String accessKey
) {}