package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import qrorder.system.config.tenant.TenantContext;
import qrorder.system.dto.response.CategoryResponse;
import qrorder.system.dto.response.MenuItemResponse;
import qrorder.system.service.MenuService;

import java.util.List;

@RestController
@RequestMapping("/api/public") // API công khai, không cần /admin
public class PublicMenuController {

    @Autowired
    private MenuService menuService;

    // API lấy tất cả Category của chi nhánh hiện tại
    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> getPublicCategories() {
        // Tự động lấy storeId mà Interceptor đã lưu
        Long storeId = TenantContext.getTenantId();

        List<CategoryResponse> categories = menuService.getCategoriesByStore(storeId);
        return ResponseEntity.ok(categories);
    }

    // API lấy tất cả MenuItem của chi nhánh hiện tại
    // (Có thể lọc theo category)
    @GetMapping("/menu-items")
    public ResponseEntity<List<MenuItemResponse>> getPublicMenuItems(
            @RequestParam(required = false) Long categoryId) {

        Long storeId = TenantContext.getTenantId();

        List<MenuItemResponse> items;
        if (categoryId != null) {
            items = menuService.getMenuItemsByCategory(categoryId, storeId);
        } else {
            items = menuService.getMenuItemsByStore(storeId);
        }
        return ResponseEntity.ok(items);
    }
}