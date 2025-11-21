package qrorder.system.config.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

/**
 * Một class UserDetails tùy chỉnh để lưu trữ thêm thông tin
 * (như storeId) vào trong Security Principal.
 */
public class StoreUserDetails implements UserDetails {

    private final String username;
    private final String password;
    private final Long storeId;
    private final Collection<? extends GrantedAuthority> authorities;
    // Thêm các trường khác nếu cần...

    public StoreUserDetails(String username, String password, Collection<? extends GrantedAuthority> authorities, Long storeId) {
        this.username = username;
        this.password = password;
        this.authorities = authorities;
        this.storeId = storeId;
    }
    // Getter cho storeId để các service khác có thể sử dụng
    public Long getStoreId() {
        return storeId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    // Các phương thức khác của UserDetails
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}