# Kế hoạch khắc phục module kho hàng

Ngày lập/cập nhật: 2026-09-29. Trạng thái: đang triển khai; lõi ghi sổ, điều chuyển, đảo phiếu xuất, cấp phát/thu hồi nội bộ và công cụ đối soát chỉ đọc đã nghiệm thu chức năng cục bộ, chưa triển khai production hoặc sửa dữ liệu cũ.

## Tiến độ đã nghiệm thu

Chỉ đánh dấu `[x]` cho phạm vi đã có mã và kiểm chứng; không coi toàn bộ đợt là hoàn tất khi còn hạng mục mở.

- [x] Tách Node/Vitest, sửa kỳ vọng tracking mode cũ và đưa `test:inventory` vào CI.
- [x] Bổ sung regression test replica set cho ghi tồn một phần, retry, cạnh tranh tồn cuối, IMEI sai SKU/kho, lỗi sự kiện và nhập trùng IMEI.
- [x] Chặn ghi đè phạm vi khi đăng ký IMEI; xác thực quan hệ công ty–chi nhánh–kho–SKU trong đăng ký máy và xuất thủ công.
- [x] Thay xử lý StockLog trong CRUD bằng service nghiệp vụ dùng transaction; nhập hàng và stock writer không fallback sang ghi từng phần.
- [x] Khóa chống ghi lặp/fingerprint cho tạo phiếu thủ công; frontend giữ khóa khi thử lại; hoàn thành phiếu lặp không trừ tồn lần hai.
- [x] Xuất thủ công kiểm tra đủ mã máy, đúng SKU/kho/trạng thái, cập nhật có điều kiện; hủy máy ghi `scrapped`.
- [x] Phiếu hoàn thành giữ kho đã lưu khi đổi nhanh trạng thái; chặn sửa/xóa phiếu đã ghi sổ ở backend.
- [x] Snapshot giá vốn xuất theo bình quân tồn; StockLog do writer sinh giữ warehouseId/variantId.
- [x] Luồng bổ sung phiếu trả hàng cũ đối chiếu ledger tường minh, không dùng replay lỏng và không cộng lại tồn.
- [x] Nghiệm thu đợt đầu: 142 test đạt (34 Node + 108 Vitest), typecheck/build đạt; build có cảnh báo kích thước bundle.
- [x] Điều chuyển có chứng từ: xuất → transit → nhận/hủy, bảo toàn lượng/giá vốn, đồng bộ máy và sự kiện trong transaction; khóa chống gửi lặp.
- [x] Tab Điều chuyển cho hàng số lượng và IMEI/mã nội bộ, chọn kho thực tế, nhận nguyên phiếu theo quyền/chi nhánh; nút chuyển máy mở quy trình mới.
- [x] Nghiệm thu điều chuyển: 158 test đạt (34 Node + 124 Vitest), gồm 14 ca tích hợp điều chuyển và 5 ca giao diện; typecheck và build frontend/backend đạt. Build còn cảnh báo bundle lớn hơn 500 kB.
- [x] Đảo nguyên phiếu xuất thủ công: chứng từ nhập liên kết phiếu gốc, hoàn đúng kho/giá vốn, khôi phục máy có điều kiện, lý do/tác nhân và chống đảo lặp trong transaction.
- [x] Giao diện xác nhận đảo phiếu; nhãn và bản in phân biệt phiếu đã đảo; chỉ số máy đã xuất loại phiếu nháp/đã đảo.
- [x] Nghiệm thu sau đảo phiếu: 174 test kho đạt (34 Node + 140 Vitest); typecheck/build frontend/backend đạt. Có 10 ca tích hợp đảo phiếu và 6 ca giao diện/chỉ số/bản in bổ sung; build vẫn cảnh báo bundle lớn.
- [x] Cấp phát nội bộ theo IMEI/mã nội bộ: trạng thái `internal_use`, người nhận/lý do bắt buộc khi ghi sổ, snapshot giá vốn và tác nhân xác thực.
- [x] Thu hồi nguyên phiếu về kho gốc qua chứng từ đảo; chặn bán/chuyển/đổi trạng thái tắt và quét máy nội bộ thành tồn kho. Giao diện hiển thị người nhận/giá vốn/chứng từ.
- [x] Nghiệm thu sau cấp phát nội bộ: 186 test kho đạt (34 Node + 152 Vitest); typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn.
- [ ] Đảo phiếu nhập và chứng từ gắn công nợ theo nghiệp vụ nguồn.
- [x] Công cụ đối soát chỉ đọc: baseline tường minh, snapshot nhất quán, giới hạn phạm vi/tải và xuất JSONL/CSV theo luồng; báo thiếu bằng chứng riêng, không mặc định tồn đầu kỳ bằng 0.
- [x] Nghiệm thu đối soát: 201 test kho đạt (34 Node + 167 Vitest), typecheck đạt; bổ sung 15 ca tích hợp, gồm chạy CLI thật trên replica set cục bộ và kiểm tra không ghi database.
- [ ] Xử lý dữ liệu cũ đã đối soát; hoàn thiện các writer retail/repair cùng chứng từ cha.
- [x] Kiểm soát đăng ký serial/unit barcode theo số tồn tại đúng công ty/chi nhánh/kho/SKU; khóa balance trong transaction, chặn vượt tồn và hoàn tác nguyên lô khi lỗi.
- [x] Nghiệm thu đăng ký theo tồn: 210 test kho đạt (34 Node + 176 Vitest), typecheck và build frontend/backend đạt; bổ sung 9 ca tích hợp gồm tranh suất cuối, nhập từ kho trống, retry xác nhận và xuất đồng thời. Build vẫn có bundle lớn hơn 500 kB.
- [x] Mã phiếu nhập nguyên tử theo công ty/chi nhánh/ngày nghiệp vụ; múi giờ cấu hình, không tái sử dụng số sau xóa/lỗi và retry trùng mã có giới hạn.
- [x] Kiểm thử cấp mã: 218 test kho đạt (34 Node + 184 Vitest), build frontend/backend đạt; bổ sung 8 ca tích hợp/biên ngày. Typecheck không còn lỗi phần kho nhưng toàn repository còn 2 lỗi ở `CustomerTransactionDetailModal.tsx`: dòng 252 (`title` trên icon) và 538 (`discountAmount` không có trong kiểu dữ liệu). Chưa coi typecheck toàn dự án là đạt; không sửa màn hình khách hàng trong đợt này. Build còn cảnh báo bundle lớn.
- [x] Kiểm kê đồng thời: kiểm tra version khi lưu, retry lượt quét tối đa 5 lần, không ghi đè lượt quét hoặc lưu bản cũ sau gửi duyệt; giới hạn cập nhật trạng thái conflict.
- [x] Nghiệm thu kiểm kê đồng thời: 226 test kho đạt (34 Node + 192 Vitest), build frontend/backend đạt; bổ sung 8 ca tích hợp. Typecheck không có lỗi phần kho nhưng còn 5 lỗi module khách hàng: 3 lỗi kiểu `deviceInfo/statusLabel/warrantyInfo` trong `customer-purchase-history.service.test.ts` (172/179/180), và 2 lỗi `CustomerTransactionDetailModal.tsx` (252/538) đã ghi ở đợt trước. Build còn cảnh báo bundle lớn.
- [x] Phiên bản từ giao diện khi sửa số lượng/ghi chú kiểm kê; đồng bộ ngoại tuyến giữ phiên bản gốc, không tự ghi đè khi xung đột; tải lại phiếu có xác nhận.
- [x] Nghiệm thu sửa từ màn hình cũ: 236 test kho đạt (34 Node + 202 Vitest), build frontend/backend đạt, còn cảnh báo bundle lớn. Bổ sung 2 ca backend, 6 ca service ngoại tuyến và 2 ca UI. Typecheck không có lỗi phần kho, còn 5 lỗi module khách hàng như đợt trước (dòng UI hiện là 261/617 do mã ngoài phạm vi tiếp tục thay đổi).
- [x] Snapshot kiểm kê nhất quán trong transaction; lưu mốc bắt đầu chốt, kiểm tra đầy đủ tập SKU khi duyệt và xử lý phiếu kho trống.
- [x] Nghiệm thu snapshot: 242 test kho đạt (34 Node + 208 Vitest), typecheck toàn dự án và build frontend/backend đạt. Bổ sung 6 ca tích hợp; các lỗi typecheck module khách hàng ghi ở các đợt trước không còn xuất hiện trong lần chạy này. Build còn cảnh báo bundle lớn hơn 500 kB.
- [ ] Quyền duyệt kiểm kê độc lập/cấm tự duyệt và UX tạo lại phiếu conflict; rà cách cấp mã các loại phiếu còn lại.
- [ ] Làm mới theo chi nhánh, phân trang/aggregate, dự báo và nghiệm thu staging/phát hành.

Đợt 4 đã hoàn thành phạm vi mã và kiểm thử cục bộ. Đợt 0–3, 5 và 8 hiện mới hoàn thành một phần. Danh sách bên dưới giữ nguyên phạm vi mục tiêu để tiếp tục triển khai; chưa mở PR hoặc triển khai production.

## 1. Mục tiêu và phạm vi

Khắc phục toàn bộ phát hiện trong đợt đánh giá: phạm vi tenant khi tạo serial; transaction và idempotency; đồng bộ điều chuyển; xác thực máy xuất; bất biến chứng từ đã ghi sổ; chọn đúng kho khi hoàn thành phiếu; giá vốn; làm mới theo chi nhánh; phân quyền duyệt kiểm kê; dự báo; phân trang lịch sử; cấp mã phiếu đồng thời; tổ chức test và CI.

Phạm vi kiểm tra lan truyền gồm nhập hàng, xuất thủ công, bán lẻ, hủy/trả hàng, sửa chữa, kiểm kê, đăng ký/chuyển trạng thái serial và migration tồn đầu kỳ. Mọi đường ghi phải tuân thủ cùng quy tắc, kể cả API CRUD cũ.

Không mở rộng thành dự án mua hàng/ERP mới. Các trường hợp chưa được xác nhận bằng kiểm thử phải được tái hiện trước khi coi là lỗi đã chứng minh. Dữ liệu production và khả năng transaction thực tế chưa được kiểm tra.

## 2. Quy tắc bắt buộc sau sửa

1. Company/branch lấy từ ngữ cảnh xác thực; kho, SKU và máy phải thuộc đúng phạm vi đã được phép truy cập.
2. Phiếu, số tồn, ledger, serial/event và công nợ liên quan cùng thành công hoặc cùng hoàn tác.
3. Cùng một thao tác gửi lại chỉ ghi sổ một lần; cùng khóa nhưng payload khác phải bị từ chối.
4. Phiếu đã ghi sổ bất biến về hàng, kho, số lượng, giá vốn và nguồn; sửa sai bằng chứng từ đảo/điều chỉnh có liên kết.
5. Xuất máy phải kiểm tra đủ số lượng mã duy nhất, đúng SKU, đúng kho và đúng trạng thái ngay tại backend.
6. Không bán vượt tồn khả dụng, trừ đường nghiệp vụ có quyền và chính sách cho phép tồn âm rõ ràng.
7. Điều chuyển bảo toàn tổng lượng và giá trị giữa kho gửi, đang vận chuyển và kho nhận.
8. Đối soát theo tracking mode: hàng quantity so balance với ledger; hàng serial/unit_barcode so thêm số máy ở từng nhóm trạng thái/vị trí. Không mặc định mọi trạng thái serial đều tương đương tồn có thể bán.
9. Giữ baseline tồn đầu kỳ/migration khi đối soát, không mặc định ledger lịch sử đã đầy đủ.

## 3. Trình tự triển khai

### Đợt 0 — Tái hiện lỗi và thiết lập đối soát (PR 01)

- Lập danh sách mọi nơi ghi InventoryBalance, InventoryLedgerEntry, SerialUnit, StockLog, GoodsReceipt và quan hệ với Product legacy.
- Tạo fixture MongoDB replica set cục bộ cho hai công ty, hai chi nhánh, kho mặc định/kho phụ, hàng quantity và serial.
- Viết regression test cho lỗi phạm vi, phiếu nhiều dòng lỗi giữa chừng, chuyển kho, IMEI sai SKU/kho, sửa/xóa phiếu đã ghi sổ và hoàn thành phiếu kho phụ.
- [x] Thêm công cụ đối soát chỉ đọc, xuất JSONL/CSV: lệch balance–ledger có baseline, lệch serial–balance, serial sai vị trí, chứng từ/ledger mồ côi, giá vốn bất thường, phiếu confirmed thiếu máy và chuyển kho dang dở.
- [x] Báo cáo company, branch, warehouse, SKU, document ID khi có và lý do; chạy theo phạm vi, cursor theo batch, không tải toàn database vào RAM.
- [x] Tách runner node:test và Vitest. Cập nhật kỳ vọng tracking mode bằng đối chiếu yêu cầu nghiệp vụ, không xóa test để làm xanh.

Nghiệm thu: tái hiện được lỗi bằng fixture; đối soát không ghi dữ liệu; fixture đúng không sinh cảnh báo sai. Những test đỏ phải được chuyển xanh cùng bản sửa tương ứng, không đưa nhánh phát hành vào trạng thái đỏ kéo dài.

Công cụ đã nghiệm thu cục bộ: `npm run audit:inventory -- --help`; hướng dẫn tại [reconciliation/README.md](../server/modules/inventory/reconciliation/README.md). Bắt buộc URI riêng, tên database và công ty; hỗ trợ lọc chi nhánh/kho. Đọc cùng một snapshot, không nhập bootstrap ứng dụng hoặc tự tạo index. Baseline có mốc thời gian và checksum; thiếu baseline/bằng chứng lịch sử được phân loại cần đối chiếu. File `.partial` hoặc thiếu `summary.json` hợp lệ có `complete: true` không được xem là báo cáo hoàn tất. CSV chặn công thức từ dữ liệu chuỗi.

15 ca kiểm thử đối soát bao gồm bảo toàn snapshot khi dữ liệu đổi đồng thời, baseline/giá trị, tenant, máy đã bán sau nhập, transit, cấp phát nội bộ và giá vốn, tham chiếu retail/repair, giới hạn đọc, CSV và CLI hoàn tất/dở dang/không ghi đè. Chưa chạy đối soát trên staging/production, chưa sửa dữ liệu cũ. Retail/repair mới kiểm tra tham chiếu chứng từ, chưa đối soát toàn bộ tài chính; hàng lô chỉ kiểm tra lượng tổng. Danh sách mọi writer và sửa sai nghiệp vụ nguồn vẫn còn mở.

### Đợt 1 — Cô lập phạm vi dữ liệu (PR 02, ưu tiên triển khai sớm)

Tệp chính: serial-unit.controller.ts, serial-unit.service.ts, serial-transfer.service.ts, warehouse.service.ts, crud.service.ts và validation dùng chung.

- Thay spread req.body bằng DTO whitelist; từ chối các trường phạm vi do client cố ghi đè.
- Xác thực quan hệ công ty–chi nhánh–kho đang hoạt động; ProductVariant phải thuộc ProductCatalog và công ty hiện tại.
- Bỏ cơ chế tự dựng sản phẩm hợp lệ chỉ từ SKU do client gửi khi không tìm thấy dữ liệu gốc. Nếu cần legacy, resolve qua mapping đã xác thực.
- [x] Đăng ký serial thủ công chỉ bổ sung mã cho số tồn đã có tại đúng kho/SKU. Nhập tồn mới dùng chứng từ nhập hàng, ghi tăng balance trước khi đăng ký máy trong cùng transaction.
- Kiểm tra lại quyền API trực tiếp, không dựa vào việc giao diện có ẩn nút hay không.

Nghiệm thu: request sửa company/branch/kho hoặc ghép SKU với product không tương ứng không tạo bất kỳ bản ghi hay event nào. Các ca hợp lệ trong cùng phạm vi tiếp tục hoạt động.

Đăng ký theo tồn đã nghiệm thu: tăng `balance.version` để tuần tự hóa các yêu cầu đăng ký và xung đột với writer nhập/xuất, sau đó đếm máy `in_stock` trong cùng transaction. Không thay đổi quantity, reservedQuantity, averageCost hoặc tạo ledger khi chỉ bổ sung mã. Tồn đặt trước vẫn là tồn vật lý có thể bổ sung mã; máy đã bán/nội bộ/transit không tính là máy đang ở kho vật lý. Máy legacy thiếu variantId được tính theo product/SKU trong đúng kho. Thiếu balance, tồn không nguyên dương hoặc đã gắn đủ mã trả lỗi 409; mọi cập nhật version/máy/event trong lô đều rollback nếu lỗi. Truyền tên chứng từ từ client không bỏ qua kiểm tra này.

9 ca bổ sung kiểm tra giới hạn, không lấy tồn kho khác, mã legacy, rollback khi lưu event lỗi, tranh suất cuối, đăng ký đồng thời xuất và xác nhận phiếu nhập từ kho trống/retry. Thay đổi version cũng khiến phiếu kiểm kê đã chụp danh sách máy cũ phải xử lý conflict. Chưa sửa dữ liệu lịch sử và chưa thống nhất toàn bộ API chuyển trạng thái máy; không coi hạng mục vòng đời serial tổng thể là hoàn tất.

### Đợt 2 — Một đường ghi sổ nguyên tử (PR 03–04)

Tệp chính: stock-movement.service.ts, crud.service.ts, receiving.service.ts, database.ts; các caller retail-stock, retail-restock, repair-part, inventory-count.

- Tạo service nghiệp vụ ghi sổ dùng chung; API CRUD cũ ủy quyền vào service này thay vì tự ghi tồn/serial.
- Các entry point mở transaction; helper bắt buộc nhận session đang có transaction. Tái sử dụng session của nghiệp vụ cha, tránh transaction lồng nhau.
- Với thao tác kho, kiểm tra khả năng transaction trước khi ghi. Nếu không hỗ trợ, trả lỗi rõ và không ghi một phần; không thay đổi fallback toàn hệ thống một cách mù quáng.
- Validation toàn phiếu trước ghi, đồng thời giữ điều kiện tồn/version tại lệnh cập nhật để chống cạnh tranh sau validation.
- Thêm khóa thao tác ổn định theo company + loại thao tác + chứng từ; fingerprint payload; lưu kết quả trong cùng transaction. Tạo phiếu mới cũng nhận request key ổn định để retry không sinh phiếu thứ hai.
- Không nuốt duplicate-key bất kỳ thành thành công. Phân biệt xung đột khóa thao tác với lỗi unique khác; xử lý replay sau khi transaction lỗi đã kết thúc.
- Khi retry transaction, không phát socket, gửi thông báo hoặc gọi dịch vụ ngoài trong callback có thể chạy lại; phát sau commit, hoặc dùng outbox nếu cần giao nhận bền vững.
- Lưu warehouseId, variantId và liên kết nguồn đầy đủ vào bản ghi giao dịch phục vụ đọc; xác định ledger là nguồn biến động, StockLog là chứng từ/biểu diễn tương thích.

Nghiệm thu: lỗi ở bất kỳ dòng hay bước serial/debt đều rollback; retry tuần tự/đồng thời không trừ hai lần; hai phiếu tranh máy/tồn cuối chỉ một phiếu thành công; database không hỗ trợ transaction không nhận ghi dở dang.

### Đợt 3 — Xuất hàng và vòng đời chứng từ (PR 05)

Tệp chính: crud.service.ts, stock-log.model.ts, serial-state.ts, InventoryTab.tsx, OutboundSection.tsx, OutboundCreateModal.tsx và inventoryStockLogService.ts.

- [x] Lấy kho từ chứng từ đã lưu khi ghi sổ; sửa kho khi nháp có validation. Đổi nhanh trạng thái giữ nguyên warehouseId tại backend.
- [x] Chặn trạng thái ngoài danh sách cho phép; xử lý hoàn thành/retry của hai nhãn tiếng Việt đang dùng. Chưa thay toàn bộ status thành enum nội bộ mới.
- [x] Bắt buộc số serial/unit barcode duy nhất bằng quantity nguyên; máy đúng product/variant/kho và khả dụng. Không bỏ qua mã không tìm thấy.
- [x] Update serial theo điều kiện trạng thái/vị trí kỳ vọng và kiểm tra số dòng thực sự cập nhật.
- [x] Lifecycle cơ bản: bán → sold, hủy → scrapped, điều chuyển dùng chứng từ riêng, cấp phát → internal_use, thu hồi đủ nguyên phiếu → in_stock. Trạng thái nội bộ có schema, bộ lọc/nhãn, thông tin người nhận và kiểm tra bán/kiểm kê tương ứng.
- [x] Chặn sửa/xóa phiếu đã ghi sổ tại backend; chưa mở sửa metadata sau ghi sổ.
- [x] Đảo nguyên phiếu xuất thủ công có liên kết gốc, lý do, người thực hiện và khóa chống đảo lặp. Hoàn máy chỉ khi trạng thái/vị trí/chứng từ hiện tại và sự kiện gần nhất vẫn khớp lần xuất gốc.
- [ ] Mở rộng đảo/điều chỉnh cho phiếu nhập và các chứng từ nghiệp vụ có công nợ; điều chỉnh từng phần và phiếu thay thế có liên kết riêng chưa mở.
- [x] Chặn nhập thủ công hàng serial bỏ qua quy trình tiếp nhận.

Nghiệm thu: xuất thiếu/thừa/trùng/sai mã bị từ chối nguyên tử; kho phụ không bị đổi về kho mặc định; sửa/xóa qua API cũng bị chặn; chứng từ đảo khôi phục đúng số lượng, giá trị và serial.

Phạm vi đảo đã triển khai: API `POST /inventory/stock-logs/:id/reverse` yêu cầu `inventory:manage`; chỉ nhận lý do, không nhận kho/hàng/giá vốn do client chỉ định. Phiếu đảo là StockLog nhập `stock-log-reversal`, có `reversalOf`, tác nhân xác thực và ledger riêng; phiếu gốc chỉ thêm liên kết `reversalId`/thời điểm đảo. Hai yêu cầu đồng thời chỉ tạo một phiếu; retry cùng lý do trả lại kết quả cũ, lý do khác bị từ chối. Hoàn theo giá vốn ledger gốc kể cả khi bình quân hiện tại đã thay đổi. Đồng bộ cả Product legacy nếu phiếu gốc dùng sản phẩm legacy.

Giới hạn: từ chối phiếu thiếu/mâu thuẫn ledger, tồn hiện tại bị mất/tồn âm hoặc máy đã có nghiệp vụ tiếp theo. Chưa tự sửa dữ liệu lịch sử; chưa đảo phiếu nhập, chứng từ bán lẻ/công nợ hoặc điều chuyển bằng API này. Sau khi đảo, có thể tạo phiếu xuất mới theo quy trình hiện có; chưa tự tạo phiếu thay thế. Số liệu tổng hợp ở các module báo cáo khác vẫn thuộc đợt rà giá vốn/dự báo tiếp theo.

Nghiệm thu đợt đảo phiếu: 10 ca tích hợp bao phủ hoàn giá vốn cũ sau nhập giá mới, retry/đồng thời, bán/hủy máy, sự kiện phát sinh sau xuất, rollback khi ghi sự kiện lỗi, ledger thiếu/lệch, phạm vi và loại chứng từ, Product legacy, balance thiếu/tồn âm. 6 ca giao diện kiểm tra lý do, quyền/loại phiếu, retry, phiếu đã đảo, chỉ số và bản in. Mốc này `test:inventory` đạt 174/174; typecheck và build đạt. Đợt 3 vẫn chưa đánh dấu hoàn tất toàn bộ vì còn phạm vi đảo mở rộng.

Đợt cấp phát nội bộ tiếp theo đã triển khai:

- Máy được xuất khỏi số tồn khả dụng và lưu `internalUse` gồm tên người/phòng ban nhận, thời điểm cấp phát, ID phiếu và giá vốn; `warehouseId` giữ kho gốc để hoàn trả, người nhận là vị trí sử dụng hiện tại. Không gắn trạng thái bán hay tạo nghiệp vụ bán lẻ.
- CRUD truyền tác nhân từ ngữ cảnh xác thực vào service riêng, tách khỏi tên người phụ trách do client chọn. Phiếu lưu `createdById`, `postedById/Name`, `postedAt`; sự kiện máy lưu đúng người ghi sổ. Nháp được phép thiếu người nhận/lý do, nhưng không được ghi sổ khi thiếu.
- Thu hồi toàn bộ qua chứng từ đảo đã có: cần máy còn thuộc đúng lần cấp phát, người nhận/giá vốn khớp, chưa có nghiệp vụ tiếp theo; hoàn giá vốn gốc và xóa thông tin cấp phát đang hiệu lực. Retry chuyến thu hồi cũ không tác động đến lần cấp phát mới.
- Bộ chọn bán loại máy nội bộ kể cả mã đã được client chọn sẵn; xuất bán/điều chuyển và API đổi trạng thái chung bị chặn. Kiểm kê không đưa máy cấp phát vào danh sách máy dự kiến trong kho và báo quét ngoài dự kiến nếu gặp máy đó.
- Thêm 9 ca tích hợp, 1 ca truyền tác nhân qua CRUD và 2 ca giao diện; toàn bộ test kho đạt 186/186. Phạm vi còn mở: thu hồi một phần, điều chuyển người sử dụng, xử lý máy hỏng/thất lạc, khấu hao/tài sản cố định và tự sửa dữ liệu cấp phát cũ. Tên người nhận là snapshot nhập trên phiếu, chưa liên kết hồ sơ nhân sự.

### Đợt 4 — Điều chuyển có chứng từ (PR 06)

Tệp chính: serial-transfer.service.ts, serial-unit.service.ts, model/service/controller điều chuyển mới; màn hình IMEI và phiếu xuất liên quan.

- [x] Dùng một Transfer document có kho gửi/nhận, chi nhánh, dòng SKU/máy, giá vốn mang theo và lịch sử tác nhân.
- [x] Gửi hàng ghi giảm kho gửi và tăng kho transit không bán được; nhận hàng chuyển từ transit sang kho nhận. Mỗi chuyến có vị trí transit riêng để giữ giá vốn; danh sách Điều chuyển hiển thị lượng và giá vốn đang vận chuyển.
- [x] Hủy trước nhận đảo từ transit về kho gửi; sau nhận phải tạo chuyển ngược bằng chứng từ mới. Mỗi chuyến có ID riêng; nhận/hủy lặp không phát sinh thêm biến động.
- [x] Cùng service xử lý hàng quantity và serial/unit_barcode; API chuyển trực tiếp cũ bị khóa, API yêu cầu/nhận/hủy cũ dùng adapter theo chứng từ. Chặn đổi trạng thái transit bằng API lifecycle chung.
- [x] Xác thực kho nhận hoạt động/đúng chi nhánh; API ghi yêu cầu `inventory:manage`, bên nhận chỉ nhận trong chi nhánh mình. Chi nhánh đang giữ, đang nhận hoặc từng tham gia chuyến chuyển được xem lịch sử máy trong cùng công ty.
- [x] Nhận nguyên phiếu; adapter theo máy không được âm thầm nhận/hủy một phiếu nhiều hàng. Chưa mở nhận từng phần.

Nghiệm thu: A → transit → B bảo toàn lượng/giá trị; máy transit không bán được; nhận/hủy đồng thời chỉ một thao tác thắng; gửi lại không tạo thêm biến động; không nhận vào kho ngoài phạm vi.

Kết quả cục bộ: 14 test tích hợp replica set kiểm tra các bất biến trên, hoàn tác khi ghi sự kiện lỗi, SKU sau thiếu tồn, giá vốn khác nhau giữa chuyến, alias trùng, cùng/khác chi nhánh, API cũ và retry từ chuyến trước. 5 test giao diện kiểm tra quyền thao tác, nhánh gửi/nhận, khóa khi retry và đổi chi nhánh. Ba test mock thao tác serial cũ được thay bằng kiểm thử tích hợp của cùng nghiệp vụ.

Giới hạn chuyển tiếp: không tự sửa các máy `in_transit` cũ không có chứng từ mới; cần đối soát và quyết định phục hồi riêng. Hàng theo lô chưa được mở trên phiếu này. Transit bị loại khỏi chọn kho vật lý, tồn khả dụng và tạo kiểm kê; dữ liệu lượng/giá vốn chuyến vẫn giữ để tra cứu. Chưa chạy migration hoặc nghiệm thu staging.

Kiểm tra bổ sung ngoài bộ test kho: `server/config/permission-route-inventory.test.ts` còn 3 test lỗi (2 kỳ vọng alias/mount webhook, 1 baseline toàn repository kỳ vọng 44 findings nhưng hiện có 51). Sáu route điều chuyển mới đều được scanner nhận đúng quyền `inventory:read/manage`, không có finding; 51 findings nằm ở các router khác. Không đổi baseline hay sửa webhook trong đợt này. Test hợp đồng API serial cập nhật đạt 3/3.

### Đợt 5 — Giá vốn và mã chứng từ (PR 07)

- Dùng bình quân gia quyền hiện có làm nguồn giá vốn cho xuất thông thường; snapshot unitCost vào ledger trong transaction từ balance trước xuất, không nhận tùy ý từ client.
- Giá nhập dùng chi phí đã xác thực của phiếu; điều chuyển mang giá vốn kho gửi; trả/hủy bán và đảo phiếu dùng giá vốn gốc có tham chiếu, tránh lấy giá hiện tại tùy tiện.
- Quy định rõ làm tròn và xử lý tồn âm/tồn về 0; kiểm thử số tiền lớn và nhập giá 0 hợp lệ. Không đổi sang định giá riêng theo IMEI trong cùng đợt sửa.
- Rà các báo cáo/finance đang đọc ProductPrice, StockLog hoặc ledger để không có hai nguồn giá vốn mâu thuẫn.
- Dùng bộ đếm nguyên tử theo company/branch/ngày nghiệp vụ cho mã phiếu; lấy ngày theo múi giờ cấu hình, có unique index và retry có giới hạn. Chấp nhận khoảng trống số khi nghiệp vụ thất bại; không tái sử dụng số.

Phạm vi đã nghiệm thu chức năng cục bộ: phiếu nhập GoodsReceipt đã thay `countDocuments + 1` bằng bộ đếm riêng `InventoryReceiptCounter`. Khóa `_id` duy nhất là tổ hợp company/branch/ngày; tăng nguyên tử với write concern majority ngoài thao tác lưu phiếu, nên xóa phiếu hoặc lỗi lưu không trả lại số. Mã mới có dạng `PN-<BRANCH_OBJECT_ID>-YYYYMMDD-000001`, dùng ID đầy đủ để không trùng do mã chi nhánh đổi hoặc chuẩn hóa mất ký tự. Giữ nguyên mã phiếu cũ, không đổi tham chiếu lịch sử.

Ngày cấp số lấy tại lúc tạo phiếu theo `INVENTORY_TIME_ZONE`, mặc định `Asia/Ho_Chi_Minh`, không lấy từ ngày nhập do client truyền. Cấu hình sai báo lỗi, không tự rơi về UTC. Retry tối đa 5 lần khi tranh tạo counter và 10 lần khi unique index company/receiptCode báo trùng; lỗi unique khác được trả nguyên trạng. Giữ unique index phiếu nhập hiện có. Phải sao lưu/khôi phục counter cùng dữ liệu chứng từ; không xóa/reset counter. Đợt này chưa thay mã kiểm kê ngẫu nhiên hoặc cách đặt mã của chứng từ khác; chống tạo trùng cả phiếu khi client retry là hạng mục idempotency riêng.

Nghiệm thu: nhập nhiều giá → xuất → trả → chuyển → kiểm kê cho giá trị theo công thức đã chốt; xuất catalog không tự mang giá vốn 0; tạo đồng thời không trùng mã.

### Đợt 6 — Kiểm kê và phân quyền (PR 08)

Tệp chính: inventory-count.service.ts/model/rules/router, permission-catalog, cấu hình role và InventoryCountingSection.tsx.

- Tách quyền duyệt/điều chỉnh khỏi quản lý thông thường theo quy ước permission hiện tại; cập nhật catalog, route coverage và UI.
- Người lập không tự duyệt theo chính sách mặc định; nếu cần ngoại lệ quản trị, phải là quyền riêng có audit, không tự cấp cho mọi inventory:manage.
- [x] Xác thực kho trong cùng transaction tạo kiểm kê; đọc balance/catalog/variant/serial theo readConcern snapshot, lưu phiếu trong transaction. Lưu `snapshotStartedAt` là giờ máy chủ bắt đầu lượt transaction thành công, không phải timestamp chính xác của MongoDB snapshot. Phiếu cũ không được gán mốc giả.
- [x] Khi duyệt, đối chiếu toàn bộ tập balance của kho cùng version từng dòng; phát hiện thêm/mất SKU ngoài danh sách phiếu, kể cả phiếu chốt lúc kho trống. Kho không đổi và phiếu trống vẫn duyệt được, không sinh ledger.
- [x] Kiểm thử cập nhật/quét đồng thời; dùng version và optimistic concurrency để tránh mất lượt quét hoặc lưu bản đã đọc trước khi gửi duyệt.

Phạm vi đã nghiệm thu cục bộ: schema InventoryCount dùng optimistic concurrency trên trường `version` hiện có. Cập nhật dòng, quét mã, gửi/hủy/bắt đầu và hoàn thành phiếu đều lưu có kiểm tra phiên bản; bản cũ trả 409 với yêu cầu tải lại. Quét mã tự đọc lại và thử tối đa 5 lần chỉ khi có lỗi version, kiểm tra lại trạng thái phiếu mỗi lần; lỗi lưu khác không tự thử lại. Quét hai mã cùng máy không tăng số đếm hai lần, các mã ngoài dự kiến đồng thời không ghi đè nhau. Chỉ đánh dấu `conflict` sau lỗi tồn kho thay đổi, với điều kiện phiếu vẫn chờ duyệt và cùng version; lỗi 409 khác không được đổi trạng thái phiếu.

Đợt tiếp theo bổ sung `expectedVersion` bắt buộc cho API sửa số lượng/ghi chú. Thiếu/sai định dạng trả 400; phiên bản cũ trả 409 trước khi ghi. Giao diện gửi version đã tải, không tự đổi sang version mới khi gặp conflict. Hàng đợi ngoại tuyến giữ version gốc; bản cũ thiếu version hoặc bị conflict được giữ lại để người dùng đối chiếu, không tự áp lên snapshot mới. Các lần đồng bộ trong cùng tab dùng chung một lượt chạy; không xóa bản chờ mới hơn được thêm trong khi đang gửi bản cũ. Nút “Tải lại phiếu” yêu cầu xác nhận, chờ lượt đồng bộ đang chạy và tải thành công trước khi bỏ bản chờ của đúng phiếu. Mã API cũ không gửi expectedVersion phải cập nhật cùng frontend.

Snapshot tạo phiếu hiện đã dùng transaction với `readConcern: snapshot` và commit majority; các truy vấn cùng session chạy tuần tự. Từ chối kho khác phạm vi, kho ngừng hoạt động hoặc transit trong snapshot. Hạ tầng không hỗ trợ transaction trả lỗi, không fallback sang đọc rời. Sáu ca mới gồm xuất hàng chen giữa hai lần đọc, thêm SKU sau khi chốt, kho trống, phạm vi/transit, tắt transaction và lỗi lưu phiếu. Việc chốt không thay đổi tồn hoặc version balance, không khóa kho suốt thời gian kiểm đếm.

Giới hạn: chưa yêu cầu version từ client cho các thao tác bắt đầu/gửi/hủy/duyệt (vẫn có optimistic concurrency phía server); chưa thay quy trình quyền duyệt/tự duyệt, xử lý máy ngoài dự kiến hoặc UX tạo lại phiếu conflict. Hàng đợi localStorage chưa được thiết kế lại để đồng bộ giữa nhiều tab hoặc phân vùng theo tài khoản; phạm vi truy cập vẫn do backend kiểm tra.
- Giải thích và cung cấp thao tác tạo lại phiếu khi conflict; không tự bỏ qua serial ngoài dự kiến hay ghi nhận tất cả máy chưa quét là mất mà thiếu xác nhận chênh lệch.
- Migration quyền có danh sách thay đổi cụ thể để không khóa nhầm quản trị viên hoặc cấp rộng quyền mới.

Nghiệm thu: người không có quyền không duyệt được; tự duyệt bị chặn theo chính sách; hai máy quét đồng thời không mất dữ liệu; thay đổi tồn làm duyệt thất bại an toàn; phê duyệt chênh lệch cập nhật balance/ledger/serial đồng bộ.

### Đợt 7 — Chi nhánh, lịch sử, dự báo và tải dữ liệu (PR 09–10)

Tệp chính: InventoryTab, WarehouseSection, ReceivingSection, SerialRegistrySection, OutboundSection, AiForecastPanel, inventoryForecast, các service đọc và API balances/history.

- Gắn cache/query identity với company/branch/warehouse; đổi chi nhánh reset bộ lọc, selection và dữ liệu nhạy theo phạm vi; hủy hoặc bỏ qua response cũ.
- Chốt hành vi bản nháp đang mở khi đổi chi nhánh, tránh submit một phiếu của A vào B. Cảnh báo mất nội dung chỉ khi có chỉnh sửa chưa lưu.
- Phân trang/tìm kiếm/lọc ở server cho lịch sử và số tồn; trả total và KPI theo toàn bộ tập đã lọc, không lấy tổng từ trang đang hiển thị.
- Thay polling toàn bộ lịch sử mỗi 5 giây bằng invalidate sau ghi, refresh có phạm vi hoặc polling phù hợp; bảo đảm subscription được dọn khi đổi chi nhánh.
- Dự báo lấy aggregate theo SKU/variant, kho và ngày trong cửa sổ đầy đủ. Chỉ tính bán đã ghi sổ; xử lý trả/hủy theo quy tắc nhu cầu ròng đã chốt. Không tính chuyển/hủy hàng/nội bộ thành nhu cầu bán.
- Gộp đúng cùng SKU nhiều kho khi xem chi nhánh; tránh map theo SKU ghi đè dòng. Loại bỏ fallback âm thầm sang dữ liệu legacy khi kho trống/lỗi tải.
- Giữ thuật toán trung bình có trọng số, ghi rõ cơ sở tính và tình trạng thiếu dữ liệu; kiểm tra ngưỡng min/max và liên kết đề xuất nhập thực sự prefill SKU/số lượng nếu UI cung cấp hành động đó.

Nghiệm thu: đổi A→B khi response A đến muộn không hiện dữ liệu A; lọc kho đúng; hơn 1.000 phiếu vẫn truy cập đầy đủ và dự báo đủ kỳ; chuyển kho không làm tăng nhu cầu; KPI đúng dù danh sách phân trang.

### Đợt 8 — CI, dữ liệu cũ và phát hành (PR 11–12)

- Thêm script test rõ cho node:test, Vitest unit/UI và integration replica set; không chạy file node:test bằng Vitest. CI chạy nhóm kho và các tích hợp bị ảnh hưởng trước phát hành, cùng typecheck/build.
- Chạy công cụ đối soát chỉ đọc trên staging/bản sao dữ liệu với phạm vi được cấp; phân loại lỗi có đủ chứng cứ để sửa tự động và lỗi cần người vận hành đối chiếu.
- Script sửa dữ liệu mặc định dry-run; có kế hoạch thay đổi từng ID, before/after, batch/checkpoint, idempotency và log để khôi phục. Không lấy riêng balance hoặc serial làm chân lý tuyệt đối để tự ghi đè nguồn khác.
- Mỗi điều chỉnh lịch sử tạo dấu vết/baseline hoặc chứng từ điều chỉnh phù hợp; giữ khả năng truy tìm dữ liệu trước sửa.
- Với phiếu đang dở và serial đang transit cũ: chuyển đổi theo nguồn chứng từ xác minh được; trường hợp thiếu nguồn đưa vào danh sách xử lý, không tự dựng chuyến chuyển giả.
- Deploy schema/index theo cách tương thích trước; kiểm tra transaction và quyền; sau đó chuyển writer sang service mới. Không cho writer cũ và mới cùng ghi độc lập vào cùng nghiệp vụ.
- Chạy smoke test nhập → xuất → trả/hủy → điều chuyển → kiểm kê → đối soát trên staging; bật phạm vi nhỏ khi phát hành và theo dõi xung đột/lệch tồn.
- Rollback ứng dụng chỉ về phiên bản tương thích schema và dữ liệu mới; không xóa ledger đã ghi sổ để rollback. Nếu phát hiện lệch sau phát hành, khóa đường ghi bị ảnh hưởng và lập điều chỉnh có kiểm soát.

Nghiệm thu: CI xanh; không còn chênh lệch chưa giải thích trong phạm vi nghiệm thu; dry-run khớp apply trên staging; chạy lại migration không phát sinh thay đổi lặp; có bằng chứng smoke test và phương án khôi phục.

## 4. Bộ kiểm thử nghiệm thu tối thiểu

| Nhóm | Tình huống bắt buộc |
|---|---|
| Phạm vi | Ghi đè company/branch, kho sai chi nhánh, SKU sai product, user không có quyền |
| Nguyên tử | Dòng 2 thiếu hàng; lỗi ledger/serial/event/debt; DB không hỗ trợ transaction |
| Đồng thời | Cùng request key; cùng key khác payload; hai phiếu tranh tồn/máy; nhận và hủy cùng lúc |
| Xuất | Kho phụ; thiếu/thừa/trùng/sai mã; máy sold/transit; trạng thái theo mục đích |
| Chứng từ | Sửa/xóa phiếu posted; đảo lặp; đảo sau khi máy đã có nghiệp vụ tiếp theo |
| Điều chuyển | Lượng và giá trị A/transit/B; mất quyền bên nhận; API chuyển cũ |
| Giá vốn | Nhiều giá nhập, trả/hủy theo giá gốc, giá 0, tồn âm theo chính sách, làm tròn |
| Kiểm kê | Hai người quét; tự duyệt; tồn thay đổi; máy ngoài dự kiến; conflict rồi tạo lại |
| Giao diện | Đổi chi nhánh khi đang tải/mở nháp; response cũ; mất quyền; lỗi tải |
| Báo cáo | >1.000 giao dịch; nhiều kho cùng SKU; loại xuất không bán; kỳ 30 ngày đầy đủ |
| Dữ liệu cũ | Baseline migration, chứng từ mồ côi, serial chưa khớp, chạy lại script |

## 5. Ước lượng và điều kiện hoàn tất

Ước lượng ban đầu cho một người triển khai: 18–28 ngày công cho mã nguồn, regression test, tích hợp và kiểm thử staging. Đây là khoảng dự kiến, cần cập nhật sau PR 01; không bao gồm thời gian đối chiếu thủ công dữ liệu cũ, chờ hạ tầng hoặc xác nhận nghiệp vụ. Các PR là đơn vị review, không bắt buộc deploy từng PR riêng.

Ưu tiên phụ thuộc: PR 01 tạo baseline; PR 02 chặn lỗi phạm vi sớm; PR 03–04 là nền cho PR 05–08; PR 09–10 xử lý đọc/UI; PR 11–12 đóng kiểm chứng và dữ liệu. Tổ chức runner/CI bắt đầu ngay từ PR 01 và được mở rộng theo từng PR, không đợi cuối mới viết test.

Hoàn tất khi tất cả phát hiện có bản sửa và regression test tương ứng; mọi đường ghi đã được rà; invariant lượng/giá trị/phạm vi đúng; CI xanh; dữ liệu trong phạm vi nghiệm thu không còn chênh lệch chưa giải thích; có kế hoạch xử lý minh bạch cho dữ liệu lịch sử chưa thể xác minh.

Các mặc định cần kiểm chứng trong giai đoạn triển khai: bình quân gia quyền là phương pháp giá vốn hiện hành; nhận điều chuyển nguyên phiếu; nội bộ cần trạng thái sử dụng riêng; quyền duyệt độc lập; hạ tầng phục vụ ghi kho phải hỗ trợ transaction. Đây là quyết định thiết kế đề xuất, chưa phải cấu hình đã tồn tại trên production.
