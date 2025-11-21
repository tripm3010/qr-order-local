package qrorder.system.service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.config.tenant.TenantContext;
import qrorder.system.entity.AppUser;
import qrorder.system.repository.AppUserRepository;

import java.util.Collections;
import java.util.List;

/**
 * Service này để Spring Security biết cách tải thông tin User (username, password, roles)
 * khi người dùng cố gắng xác thực (ví dụ: qua JWT Filter).
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private AppUserRepository appUserRepository;

    /**
     * Tải thông tin user dựa trên username.
     * [QUAN TRỌNG] Logic này lọc user dựa trên storeId (chi nhánh)
     * đã được lưu trong TenantContext (từ TenantInterceptor).
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

        // Lấy storeId (chi nhánh) mà user đang cố gắng truy cập
        // (được set bởi TenantInterceptor)
        Long storeId = TenantContext.getTenantId();

        if (storeId == null) {
            // Điều này không nên xảy ra với các API được bảo vệ,
            // nhưng là một lớp bảo vệ tốt
            throw new UsernameNotFoundException("Không thể xác định chi nhánh (storeId) cho người dùng: " + username);
        }

        // Tìm user bằng cả username VÀ storeId
        AppUser appUser = appUserRepository.findByUsernameAndStoreId(username, storeId)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy người dùng '" + username + "' tại chi nhánh này"));

        // [CẬP NHẬT] Chuyển đổi Role (String) sang GrantedAuthority
        List<GrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + appUser.getRole()) // VD: "ROLE_ADMIN"
        );

        // [CẬP NHẬT] Trả về StoreUserDetails tùy chỉnh
        // (chứa cả storeId để các service khác có thể dùng)
        return new StoreUserDetails(
                appUser.getUsername(),
                appUser.getPassword(),
                authorities,
                appUser.getStore().getId()
        );
    }
}