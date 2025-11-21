package qrorder.system.config.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod; // [MỚI] Import
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import qrorder.system.config.tenant.TenantFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthFilter jwtAuthFilter;

    @Autowired
    private TenantFilter tenantFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // 1. Cho phép Request OPTIONS (CORS preflight)
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 2. Cho phép Public API, Auth, WebSocket VÀ Hình ảnh
                        .requestMatchers("/api/auth/**", "/api/public/**", "/ws/**", "/images/**").permitAll()

                        // 3. [MỚI] Quyền cho Super Admin (Quản lý SaaS)
                        .requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")

                        // 4. Phân quyền chi tiết cho Bàn
                        // Staff được phép tạo bàn (POST)
                        .requestMatchers(HttpMethod.POST, "/api/admin/tables").hasAnyRole("ADMIN", "STAFF")
                        // Các quyền bàn khác (Delete/Put) chỉ Admin
                        .requestMatchers("/api/admin/tables/**").hasRole("ADMIN")

                        // 5. Các quyền chung cho các nhóm controller
                        // (Super Admin cũng có thể truy cập để hỗ trợ/debug)
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/kitchen/**").hasAnyRole("ADMIN", "KITCHEN", "SUPER_ADMIN")
                        .requestMatchers("/api/staff/**").hasAnyRole("ADMIN", "STAFF", "SUPER_ADMIN")

                        // 6. Còn lại phải xác thực
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(tenantFilter, JwtAuthFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}