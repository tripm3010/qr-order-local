package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import qrorder.system.dto.request.StaffCallRequest;
import qrorder.system.dto.response.StaffCallResponse;
import qrorder.system.entity.TableInfo;
import qrorder.system.repository.TableRepository;

import java.time.LocalDateTime;

/**
 * Controller này xử lý các tin nhắn WebSocket
 * (không phải API REST)
 */
@Controller
public class StaffWebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // Dùng để gửi WebSocket

    @Autowired
    private TableRepository tableRepository; // Dùng để tìm StoreId từ TableId

    /**
     * Xử lý tin nhắn khi Khách hàng gọi Nhân viên
     * Client (React) sẽ gửi đến destination: /app/call-staff
     */
    @MessageMapping("/call-staff")
    @Transactional(readOnly = true) // Cần Transactional để load Store từ Table
    public void handleStaffCall(StaffCallRequest request) {

        // 1. Lấy thông tin Bàn để biết Table Name và Store ID
        TableInfo table = tableRepository.findById(request.tableId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy Bàn ID: " + request.tableId()));

        Long storeId = table.getStore().getId();
        String tableName = table.getName();

        // 2. Tạo đối tượng response để gửi cho nhân viên
        StaffCallResponse response = new StaffCallResponse(
                request.tableId(),
                tableName,
                request.callType(),
                LocalDateTime.now()
        );

        // 3. Gửi tin nhắn đến đúng topic của chi nhánh đó
        String destination = "/topic/staff/" + storeId;

        System.out.println("Đang gửi thông báo 'Gọi nhân viên' đến: " + destination);

        messagingTemplate.convertAndSend(destination, response);
    }
}