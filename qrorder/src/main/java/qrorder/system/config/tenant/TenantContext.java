package qrorder.system.config.tenant;

/**
 * Class này sử dụng ThreadLocal để lưu trữ storeId
 * cho mỗi request một cách độc lập.
 */
public class TenantContext {

    private static final ThreadLocal<Long> currentTenant = new ThreadLocal<>();

    public static void setTenantId(Long storeId) {
        currentTenant.set(storeId);
    }

    public static Long getTenantId() {
        return currentTenant.get();
    }

    public static void clear() {
        currentTenant.remove();
    }
}