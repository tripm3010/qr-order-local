package qrorder.system.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker // Kích hoạt WebSocket
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Tiền tố cho các "chủ đề" (topics) mà server sẽ gửi (broadcast)
        // Ví dụ: /topic/kitchen/1, /topic/table/12
        registry.enableSimpleBroker("/topic");

        // Tiền tố cho các "điểm đến" (destinations)
        // mà client gửi tin nhắn lên (ví dụ: /app/call-staff)
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint mà ReactJS sẽ kết nối WebSocket tới
        // ví dụ: ws://default.localhost:8080/ws

        // [SỬA LỖI 403 - Forbidden]
        // Thêm .withSockJS() để Spring Boot hiểu
        // các yêu cầu handshake (/ws/info) của thư viện SockJS
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // Cho phép tất cả
                .withSockJS(); // <--- THAY ĐỔI QUAN TRỌNG
    }
}