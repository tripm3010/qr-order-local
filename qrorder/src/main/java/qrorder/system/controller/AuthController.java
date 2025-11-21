package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.config.tenant.TenantContext;
import qrorder.system.dto.request.AuthRequest;
import qrorder.system.dto.response.AuthResponse;
import qrorder.system.entity.Store;
import qrorder.system.repository.StoreRepository;
import qrorder.system.service.JwtService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private UserDetailsService userDetailsService;
    @Autowired
    private JwtService jwtService;

    @Autowired
    private StoreRepository storeRepository; // Cần để lấy subdomain

    /**
     * API Đăng nhập
     * Đã cập nhật để xử lý Multi-Tenant (dựa vào TenantFilter)
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> createAuthenticationToken(@RequestBody AuthRequest authRequest) throws Exception {

        // 1. Lấy storeId (chi nhánh) mà TenantFilter đã set
        Long storeId = TenantContext.getTenantId();
        if (storeId == null) {
            throw new UsernameNotFoundException("Không thể xác định chi nhánh (subdomain) hợp lệ.");
        }

        // 2. Xác thực (Spring Security sẽ tự động gọi UserDetailsServiceImpl)
        // UserDetailsServiceImpl sẽ dùng storeId từ TenantContext để tìm đúng user
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(authRequest.username(), authRequest.password())
            );
        } catch (AuthenticationException e) {
            throw new Exception("Tên đăng nhập hoặc mật khẩu không đúng", e);
        }

        // 3. Nếu xác thực thành công, tải lại UserDetails (để lấy thông tin)
        final UserDetails userDetails = userDetailsService.loadUserByUsername(authRequest.username());

        // 4. Ép kiểu về StoreUserDetails tùy chỉnh của chúng ta
        StoreUserDetails storeUserDetails = (StoreUserDetails) userDetails;

        // 5. Tạo JWT
        final String jwt = jwtService.generateToken(storeUserDetails);

        // 6. Lấy 'subdomain' để trả về cho client
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi nhánh"));
        String subdomain = store.getSubdomain();

        // 7. Trả về DTO mới (bao gồm cả jwt và subdomain)
        return ResponseEntity.ok(new AuthResponse(jwt, subdomain));
    }

    // (Thêm API /api/auth/register tại đây nếu bạn cần)
    // Nhớ dùng passwordEncoder.encode() trước khi lưu user mới
}
