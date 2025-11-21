package qrorder.system.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import qrorder.system.config.security.StoreUserDetails;
import qrorder.system.dto.request.TableRequest;
import qrorder.system.dto.response.TableResponse;
import qrorder.system.service.TableService;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tables")

public class TableManagementController {

    @Autowired
    private TableService tableService;

    private Long getStoreId(StoreUserDetails userDetails) {
        return userDetails.getStoreId();
    }


    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<TableResponse> createTable(
            @RequestBody TableRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        TableResponse table = tableService.createTable(request, userDetails);
        return ResponseEntity.ok(table);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<TableResponse>> getTables(
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        List<TableResponse> tables = tableService.getTablesByStore(getStoreId(userDetails));
        return ResponseEntity.ok(tables);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')") // Chỉ ADMIN mới được truy cập
    public ResponseEntity<TableResponse> updateTable(
            @PathVariable Long id,
            @RequestBody TableRequest request,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        TableResponse table = tableService.updateTable(id, request, getStoreId(userDetails));
        return ResponseEntity.ok(table);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')") // Chỉ ADMIN mới được truy cập
    public ResponseEntity<Void> deleteTable(
            @PathVariable Long id,
            @AuthenticationPrincipal StoreUserDetails userDetails) {

        tableService.deleteTable(id, getStoreId(userDetails));
        return ResponseEntity.noContent().build();
    }
}