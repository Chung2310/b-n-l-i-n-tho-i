# Kế hoạch khắc phục module kho hàng

Ngày lập/cập nhật: 2026-09-30. Trạng thái: đang triển khai; lõi ghi sổ, điều chuyển, đảo phiếu xuất, cấp phát/thu hồi nội bộ và công cụ đối soát chỉ đọc đã nghiệm thu chức năng cục bộ, chưa triển khai production hoặc sửa dữ liệu cũ.

## Bàn giao cuối ngày 2026-09-29 — tiếp tục ngày 2026-09-30

Điểm dừng: đã chặn API đổi trạng thái máy trực tiếp. Lần kiểm chứng gần nhất đạt **490 test kho (38 Node + 452 Vitest, 39 file Vitest)**, typecheck và build frontend/backend đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production, cấp quyền thực tế hoặc sửa dữ liệu lịch sử. Danh sách dưới đây là việc còn mở, không phải phần đã nghiệm thu.

### Vòng đời máy sửa chữa — triển khai ngày 2026-09-30

Đã bổ sung transaction chung cho tiếp nhận/chuyển trạng thái/giao máy; hủy phiếu hoàn linh kiện và giải phóng máy trong cùng transaction. Hai API giao máy dùng chung đường xử lý. Máy đã bán có thể nhận sửa ở chi nhánh khác trong cùng công ty; chi nhánh sở hữu trong kho giữ nguyên, sự kiện tiếp nhận ghi chi nhánh sửa chữa. Giao/hủy/trả máy phải khớp máy, phiếu đang giữ và bằng chứng tiếp nhận. Máy dịch vụ ngoài registry được cố định là `untracked`, không tự nhận một máy được đăng ký sau đó. Phiếu cũ có serial nhưng thiếu bằng chứng phải đối soát, không tự sinh lịch sử.

Tạo phiếu gửi lại dùng cùng `ticketCode` và fingerprint toàn bộ input/phạm vi/actor; khác nội dung trả 409. Máy quản lý trong kho chỉ được một phiếu tiếp nhận. Giao/hủy/trả lại không ghi thêm sự kiện khi gửi lại hợp lệ. Thông báo chỉ phát sau commit; caller truyền session phải cung cấp hàng đợi callback, tạo hàng đợi mới mỗi lần thử transaction và chỉ chạy sau commit thành công. Cơ chế thông báo vẫn là best-effort; chưa bổ sung outbox bảo đảm gửi lại sau khi tiến trình dừng đột ngột. Khôi phục yêu cầu phía giao diện/offline và chống tạo mã phiếu mới khi gửi lại vẫn thuộc nhóm việc còn mở bên dưới.

Kiểm chứng ngày 2026-09-30: **511 test kho đạt (38 Node + 473 Vitest, 40 file Vitest)**, gồm 21 ca tích hợp mới dùng MongoDB replica set cục bộ; **57 test sửa chữa đạt**. Typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB. Lượt kho đầu có một ca thu mua timeout 5 giây khi build/typecheck chạy đồng thời; chạy lại riêng toàn bộ bộ kho đạt, không đổi timeout hoặc bỏ assertion. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

- [x] Đọc `server/modules/repair/repair-ticket.service.ts` và `server/modules/repair/services/repair-serial-lifecycle.ts`. Điểm lỗi đã xác định: tạo phiếu và giao máy gọi `recordRepairSerialLifecycle` sau khi lưu phiếu; helper cập nhật máy rồi ghi sự kiện riêng, không dùng session của phiếu.
- [x] Gộp phiếu, trạng thái máy và sự kiện vào cùng transaction; lỗi ở bất kỳ bước nào phải rollback toàn bộ. Chỉ phát thông báo/sự kiện bên ngoài sau commit.
- [x] Kiểm tra công ty/chi nhánh và đúng máy; khi giao phải khớp phiếu đang giữ máy, không lấy máy của phiếu khác chỉ vì đang `repairing`. Xác định rõ xử lý máy khách mang đến chưa có trong registry và máy bán ở chi nhánh khác.
- [x] Chống gửi lặp/cạnh tranh khi nhận, giao và hủy sửa chữa; rà soát ảnh hưởng của hủy phiếu đến trạng thái máy. Không khôi phục API đổi trạng thái trực tiếp để vượt nghiệp vụ.
- [x] Bổ sung kiểm thử rollback, sai phạm vi/phiếu, thiếu máy, gửi đồng thời và gửi lại; chạy bộ sửa chữa liên quan, `node tools/test-inventory.mjs`, `npx tsc --noEmit`, `npm run build`. Chỉ đánh dấu hoàn tất sau khi có kết quả đạt.

### Báo giá và thu tiền sửa chữa — triển khai tiếp ngày 2026-09-30

- Báo giá/duyệt báo giá chạy trong transaction, không ghi đè phiếu vừa hủy; gửi lại báo giá cùng nội dung/phạm vi/actor không thêm lịch sử. Báo giá khác sau khi đã chốt trả 409. API đổi trạng thái chung từ chối `quoted`/`approved`; phải dùng đúng nghiệp vụ. Không tự đánh dấu đã báo khách khi chưa gửi thông báo.
- Khoản thu lưu `RepairPayment` với index duy nhất công ty/khóa yêu cầu. Chứng từ thu và số tiền trên phiếu commit/rollback cùng nhau. API bắt buộc `idempotencyKey`, `expectedPaidAmount`, `expectedTotalAmount`; fingerprint gồm phiếu/phạm vi/actor/số tiền/snapshot số dư. Cùng khóa/cùng nội dung replay; hai khóa khác nhau từ cùng số dư chỉ một được ghi. Chỉ thu khi `done`, không thu rỗng/âm/lẻ/vượt nợ, không dùng số dư mới để tự gửi lại. Phiếu mới không nhận `paidAmount` hoặc metadata báo giá đã duyệt từ client.
- Giao diện lưu nguyên khoản thu trong sessionStorage trước khi gửi, khóa thao tác khác khi đang chờ; mở lại/tải lại cùng tab giữ nguyên khóa, số tiền và snapshot. Gửi API với phạm vi đã chốt; phản hồi muộn sau đổi phạm vi/đóng form không cập nhật màn hình khác. Lỗi bộ nhớ chặn gửi; chỉ bỏ yêu cầu khi lần đầu bị từ chối rõ ràng với `REPAIR_PAYMENT_INVALID`/400. Không tự xóa xung đột 409 hoặc tạo khóa khác sau lỗi mạng.
- Phạm vi báo cáo đã kiểm tra: tổng tiền thu/còn nợ của phiếu khớp khoản thu đã commit và không nhân đôi do replay. Chưa nghiệm thu toàn bộ báo cáo, cashbook Finance hoặc hoàn tiền sửa chữa. Chưa phục hồi yêu cầu qua đóng phiên/nhiều tab/nhiều thiết bị; chưa có màn hình giải quyết xung đột 409. Frontend/backend cần phát hành cùng nhau vì client cũ thiếu metadata sẽ bị từ chối; cần kiểm tra index mới trên staging.

Kiểm chứng đạt: **543 test kho (38 Node + 505 Vitest, 42 file Vitest)**, gồm 24 ca tích hợp báo giá/thu tiền mới và 8 ca giao diện khoản thu. Bộ sửa chữa và giao diện liên quan đạt **87 test** (có 8 ca giao diện trùng bộ kho). Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Các ca bao phủ gửi đồng thời, số dư cũ, khóa khác nội dung/phạm vi/actor, rollback chứng từ/phiếu, báo giá/duyệt cạnh tranh với hủy, replay sau giao máy, tổng hợp thu/nợ, mở lại yêu cầu và phản hồi muộn. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Báo cáo chỉ đọc và bảo vệ tiền sau hoàn linh kiện — triển khai tiếp ngày 2026-09-30

- Bỏ các lệnh tự backfill `completedAt` khi đọc báo cáo doanh thu/hiệu suất kỹ thuật viên. Phiếu `delivered` cũ thiếu ngày hoàn tất dùng `deliveredAt` lúc truy vấn và nhóm ngày; phiếu có ngày hoàn tất vẫn ưu tiên ngày này, phiếu `done` thiếu ngày không tự suy diễn từ ngày giao. Finance và báo cáo sửa chữa dùng chung bộ lọc kỳ hoàn tất. Không ghi vào dữ liệu nguồn khi đọc báo cáo.
- Kiểm tra ngày không tồn tại/khoảng ngày đảo ngược cho cả báo cáo doanh thu, kỹ thuật viên, linh kiện và đánh giá; từ chối kiểu nhóm không hỗ trợ. Hiệu suất không gán phiếu thiếu kỹ thuật viên và không lấy đánh giá từ chi nhánh không khớp phiếu.
- Chỉ hoàn linh kiện mới khi phiếu đang `approved`/`repairing`/`waiting_parts`/`waiting_supplier`, hoặc trong transaction hủy phiếu. Phiếu `done`/`delivered`/`returned` và hủy ngoài quy trình bị từ chối; giao diện ẩn nút hoàn trên phiếu đã chốt. Replay của lần hoàn đã hoàn tất vẫn được trả lại. Nếu tính lại làm tổng tiền thấp hơn số đã thu, toàn bộ hoàn linh kiện/kho/phiếu rollback; không âm thầm giảm công nợ về 0 để che khoản tiền chênh lệch.
- Điều chỉnh hoàn tiền/hoa hồng bắt buộc transaction, không rơi về ghi ngoài transaction; replay kiểm tra cả lý do và người thao tác. Lỗi đối soát hoa hồng sau khi lưu hoàn tiền phải rollback. Luồng này vẫn dùng tham chiếu chứng từ hoàn tiền bên ngoài; chưa tạo phiếu chi Finance hoặc xác minh tiền đã thực chi. Doanh thu báo cáo vẫn là tổng tiền phiếu; chưa nghiệm thu khấu trừ hoàn tiền theo kỳ/thuế và tính nhất quán toàn bộ báo cáo.

Kiểm chứng đạt: **564 test kho (38 Node + 526 Vitest, 43 file Vitest)**, tăng 21 ca tích hợp; **79 test hồi quy sửa chữa/hoa hồng/Finance/giao diện hoàn linh kiện** đạt, gồm một ca UI mới. Kiểm thử theo dõi lệnh MongoDB và so sánh dữ liệu trước/sau xác nhận báo cáo không ghi dữ liệu; bao phủ mốc ngày dự phòng, biên ngày Việt Nam, phạm vi chi nhánh/công ty, chi phí ẩn, đồng bộ kỳ với Finance, hoàn linh kiện cạnh tranh với hoàn tất, rollback khi tổng thấp hơn tiền thu và lỗi hoa hồng sau khi lưu hoàn tiền. Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Chưa triển khai production, backfill hoặc sửa dữ liệu lịch sử.

### Các phần còn lại, theo nhóm

- [ ] **Yêu cầu chờ/offline:** phục hồi sau đóng phiên và giữa nhiều tab/tài khoản/thiết bị; màn hình đối chiếu yêu cầu xung đột hoặc thiếu metadata. Hiện sessionStorage chỉ bảo vệ phiên tab; không tự đổi khóa, dựng metadata cũ hoặc lấy phiên bản mới để gửi lại. Khóa thao tác linh kiện sửa chữa còn phụ thuộc vòng đời form.
- [ ] **Writer bán lẻ/sửa chữa:** rà tiếp báo giá, thanh toán, giao máy và tính nhất quán báo cáo; các phần chống gửi lặp bán lẻ đã nghiệm thu ở dưới không cần làm lại. Rà điều kiện được trả hàng ngoài kiểm tra bằng chứng máy đã hoàn tất.
- [ ] **Vòng đời chứng từ kho:** đảo phiếu nhập/chứng từ có công nợ, điều chỉnh từng phần và phiếu thay thế có liên kết; phần cấp phát nội bộ mở rộng, actor của các writer ngoài phiếu thủ công. Linh kiện sửa chữa serial/unit-barcode/lot chưa được hỗ trợ; hiện từ chối các loại này.
- [ ] **Giá vốn và mã phiếu:** chính sách tồn âm/làm tròn; rà cấp mã các loại chứng từ khác và chống tạo lặp phiếu nhập (khác với việc mã phiếu không trùng).
- [ ] **Kiểm kê/phân quyền:** cấp quyền người duyệt theo danh sách đã xác nhận; phiên bản client cho bắt đầu/gửi/hủy kiểm kê; xử lý chứng từ sửa sai cho máy ngoài dự kiến. Hiện đối chiếu không tự nhập hoặc chuyển máy; tạo lại phiếu chỉ hỗ trợ nguồn bị conflict.
- [ ] **Giao diện/báo cáo:** làm mới đúng chi nhánh, phân trang và tổng hợp phía server, dự báo chỉ dựa trên bán hàng; nghiệm thu đầy đủ báo cáo.
- [ ] **Dữ liệu cũ:** chạy công cụ đối soát chỉ đọc trên staging/bản sao, duyệt chênh lệch, đối chiếu điều chuyển đang dở rồi mới thiết kế sửa dữ liệu có bằng chứng. Chưa chạy quét dữ liệu thật; không tự backfill khóa, sự kiện hoặc nguồn giá vốn.
- [ ] **Phát hành:** diễn tập migration, kiểm tra replica set/transaction/index/quyền, smoke test toàn luồng và phương án rollback trên staging; triển khai frontend/backend đồng bộ vì client cũ thiếu khóa/phiên bản sẽ bị từ chối. Chưa có nghiệm thu staging/production.

### Hoàn tiền sửa chữa và đối soát Finance — triển khai ngày 2026-09-30

Khoản hoàn mới bắt buộc nhập mã hoặc ID phiếu chi Finance đã ghi sổ. Phiếu chi phải cùng công ty/chi nhánh, đúng số tiền, tham chiếu đúng mã phiếu sửa chữa, có người/ngày duyệt và chưa liên kết nguồn hoặc công nợ khác. Trường hợp mã trùng ID của một phiếu khác bị từ chối để tránh chọn nhầm. Ngày chi không được trước ngày hoàn tất hoặc ở tương lai; liên kết mới bị chặn nếu kỳ quỹ đã chốt. Gửi lại đúng khoản đã liên kết vẫn được sau chốt kỳ.

Liên kết phiếu chi, dòng hoàn trên phiếu sửa chữa và thu hồi hoa hồng commit trong cùng transaction. Khóa ghi sổ Finance tuần tự hóa với thao tác chốt kỳ. Một phiếu chi chỉ dùng cho một khoản hoàn, kể cả hai khóa yêu cầu cạnh tranh. Không trừ số dư quỹ lần nữa. Nguồn hoàn được nối vào danh sách chứng từ Finance để không xuất hiện như giao dịch chưa ghi sổ hoặc nguồn bị lệch. Giới hạn tổng hoàn/công/linh kiện vẫn trừ cả các khoản hoàn lịch sử; không tự hợp thức hóa tham chiếu cũ.

Báo cáo doanh thu sửa chữa và lãi lỗ Finance trừ khoản hoàn đã đối soát theo ngày phiếu chi, độc lập với kỳ hoàn tất phiếu sửa chữa; kỳ chỉ có hoàn tiền vẫn có dòng âm với số phiếu hoàn tất bằng 0. Giá vốn không giảm vì không có nghiệp vụ trả linh kiện đi kèm. Phân bổ doanh thu công/linh kiện theo tổng báo giá và cách làm tròn của hoa hồng, bảo đảm cộng lại đúng tổng; phần tăng vượt giá niêm yết theo quy tắc hiện có thuộc phần ngoài tiền công. Mở chi tiết dòng hoàn trong Finance trả đúng phiếu chi. Báo cáo hiệu suất kỹ thuật viên vẫn là doanh thu của tập phiếu hoàn tất, không phải báo cáo doanh thu ròng theo kỳ chi.

Giao diện hoàn tiền hiển thị hướng dẫn lập/duyệt phiếu chi và trạng thái đã/chưa đối soát trong lịch sử. Treasury hiển thị mã phiếu trong phần lịch sử/nguồn. Nút hoàn toàn bộ dùng số tiền còn lại sau các lần hoàn và phần công đã phân bổ giảm giá. Yêu cầu gửi kèm phạm vi cố định; chặn gửi kép và bỏ qua callback muộn sau đổi phiên/chi nhánh hoặc đóng cửa sổ. Không đổi khóa chỉ vì sửa input sau lỗi chưa rõ kết quả; khóa mới chỉ được tạo sau thành công. Khôi phục nguyên yêu cầu khi đóng phiên/nhiều tab và màn hình xử lý xung đột vẫn chưa triển khai trong đợt này.

Kiểm chứng đợt hoàn tiền: **587 test kho đạt (38 Node + 549 Vitest, 44 file Vitest)**; 84 test liên quan Finance/hoa hồng/giao diện đạt. Sau rà soát khả năng gửi lại phiếu chi gốc đã liên kết, chạy lại 51 test đối soát/treasury/báo cáo đều đạt. Typecheck và build frontend/backend đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Khôi phục và đối chiếu yêu cầu hoàn tiền — triển khai ngày 2026-09-30

Form hoàn tiền lưu nguyên số tiền, phần công, lý do, tham chiếu và khóa chống trùng trong localStorage trước khi gửi. Phạm vi lưu gồm công ty/chi nhánh/người thao tác/phiếu sửa chữa. Đóng cửa sổ hoặc mở lại trình duyệt trong cùng hồ sơ vẫn lấy đúng yêu cầu cũ; lỗi đọc/ghi hoặc dữ liệu lưu hỏng chặn gửi. Nội dung đã gửi được khóa, thử lại không tạo khóa hoặc đổi nội dung. Chỉ xóa bản lưu khớp sau khi máy chủ xác nhận thành công; không xóa yêu cầu khác vừa thay đổi.

Web Locks khóa cả quá trình đọc/lưu/gửi/đối chiếu theo cùng phạm vi giữa các tab. Tab không lấy được khóa không gửi; nếu phát hiện yêu cầu khác đã lưu thì khôi phục để người dùng đối chiếu hoặc thử lại, không ghi đè bằng bản nháp. Môi trường không hỗ trợ khóa trình duyệt bị chặn gửi và hướng dẫn mở ứng dụng qua HTTPS bằng trình duyệt hỗ trợ. Khóa chỉ điều phối cùng trình duyệt; transaction và ràng buộc phiếu chi ở máy chủ tiếp tục bảo vệ chống ghi trùng.

Nút Đối chiếu khoản hoàn gọi endpoint chỉ đọc POST /repair/tickets/:id/refunds/reconcile, yêu cầu quyền quản lý sửa chữa và phạm vi hiện tại. Máy chủ kiểm tra đầy đủ nội dung/actor và phiếu chi đã ghi sổ: công ty, chi nhánh, số tiền, tham chiếu phiếu sửa chữa, liên kết nguồn, ngày chi, người/ngày duyệt. Trả completed chỉ khi đủ bằng chứng; trường hợp tab khác dùng khóa khác chỉ được xác nhận nếu cùng ý định và duy nhất chứng từ đã liên kết. Tham chiếu trùng nhiều khoản, legacy hoặc chứng từ lệch trả conflict; chưa thấy khoản hoàn trả not_found. Không phát sinh chi tiền hay ghi dữ liệu khi đối chiếu, kể cả kỳ đã chốt.

Giới hạn còn mở: chưa có thao tác bỏ/hủy yêu cầu không thành công bằng khóa bị vô hiệu hóa ở máy chủ; not_found không chứng minh yêu cầu cũ đã ngừng chạy nên không cho xóa để tạo mới. Chưa đồng bộ qua thiết bị/hồ sơ trình duyệt khác; xóa dữ liệu trình duyệt làm mất bản lưu. Thu tiền vẫn dùng sessionStorage, tạo phiếu chưa có cơ chế phục hồi này. Khoản hoàn lịch sử vẫn cần quy trình đối soát riêng có bằng chứng.

Kiểm chứng đợt khôi phục: **609 test kho đạt (38 Node + 571 Vitest, 44 file Vitest)**, tăng 22 ca đối chiếu/khôi phục/giao diện. Typecheck và build frontend/backend đạt; cảnh báo bundle lớn hơn 500 kB vẫn còn. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Vô hiệu hóa yêu cầu hoàn tiền đang chờ — triển khai ngày 2026-09-30

Đã thêm endpoint POST /repair/tickets/:id/refunds/revoke, cùng quyền quản lý sửa chữa và kiểm tra phạm vi. Máy chủ ghi dấu vô hiệu hóa bền vững trên phiếu sửa chữa gồm khóa, nội dung gốc, actor và thời điểm. Gửi lại cùng nội dung trả revoked; khác nội dung/người thao tác trả conflict. Không tự xóa dấu vô hiệu hóa hoặc cho sử dụng lại khóa đó. Metadata này bị loại bỏ khỏi input tạo phiếu, chỉ service được ghi.

Ghi hoàn và vô hiệu hóa cùng ghi phiếu sửa chữa trong transaction bắt buộc. Khi cạnh tranh, giao dịch thua phải đọc lại: hủy thắng thì hoàn muộn bị chặn, kể cả đổi nội dung cùng khóa; hoàn thắng thì hủy trả kết quả đối chiếu completed/conflict, không đảo tiền. Có kiểm thử chủ động giữ từng giao dịch trước lúc lưu để xác minh cả hai thứ tự. Lỗi lưu dấu vô hiệu hóa rollback toàn bộ; không chấp nhận session không có transaction.

Vô hiệu hóa khóa không hủy phiếu chi, không đổi số dư quỹ/hoa hồng và không xóa khoản hoàn đã ghi nhận. Vì không ghi tiền nên được thực hiện cả khi kỳ quỹ đã chốt hoặc tham chiếu phiếu chi sai. Khi đã có khoản hoàn cùng khóa, phải đối chiếu được chứng từ mới xác nhận completed; không biến trường hợp thiếu bằng chứng thành revoked.

Giao diện có nút Hủy yêu cầu đang chờ với giải thích rõ không đảo phiếu chi. Giữ nguyên bản lưu trong lúc gửi và khi chưa rõ kết quả; chỉ xóa đúng bản lưu sau completed hoặc revoked. Với revoked, mở lại phần nhập để tạo yêu cầu mới; với completed, cập nhật phiếu. Mất phản hồi hủy có thể mở lại và đối chiếu chỉ đọc để nhận revoked. Form khôi phục vẫn xuất hiện nếu phiếu đã đổi trạng thái; không mở thêm luồng hoàn mới trên phiếu không còn delivered.

Phát hành cần cập nhật tất cả backend writer cùng phiên bản hỗ trợ dấu vô hiệu hóa. Không chạy song song hoặc rollback về writer cũ bỏ qua khóa bị hủy. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

Kiểm chứng đợt vô hiệu hóa: **623 test kho đạt (38 Node + 585 Vitest, 44 file Vitest)**, tăng 14 ca. 32 test tạo phiếu/hoa hồng/giao diện liên quan đạt; 22 test giao diện đã chạy lại sau thay đổi hiển thị form khôi phục và đều đạt. Typecheck và build frontend/backend đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Khôi phục và đối chiếu khoản thu sửa chữa — triển khai ngày 2026-09-30

Khoản thu đang chờ được lưu trong localStorage theo công ty/chi nhánh/người thao tác/phiếu, giữ nguyên khóa, số tiền và snapshot số dư. Web Locks điều phối việc đọc/lưu/gửi/đối chiếu giữa các tab cùng hồ sơ trình duyệt. Tab khác đã lưu khoản thu thì form khôi phục khoản đó để đối chiếu hoặc thử lại, không ghi đè bằng bản nháp mới. Lỗi lưu, dữ liệu hỏng, môi trường thiếu khóa hoặc khóa đang bị giữ không được gửi tiền.

Bản chờ sessionStorage của phiên bản cũ được đọc và chuyển sang localStorage khi mở form, trong khóa trình duyệt; chỉ xóa bản cũ sau khi bản mới được ghi và kiểm tra nguyên vẹn. Nếu hai bản khác nội dung thì giữ cả hai và chặn thao tác để đối soát. Sau thành công chỉ xóa đúng yêu cầu đã xác minh; phản hồi muộn không xóa yêu cầu khác vừa thay đổi. Ngoại lệ bỏ bản chờ vẫn chỉ dành cho lần gửi mới bị từ chối rõ ràng REPAIR_PAYMENT_INVALID/400; lỗi chưa rõ kết quả và xung đột không tự tạo khóa khác.

Đã thêm nút Đối chiếu khoản thu và endpoint chỉ đọc POST /repair/tickets/:id/payments/reconcile với quyền quản lý sửa chữa. Máy chủ đối chiếu công ty/chi nhánh/phiếu/actor, fingerprint, các trường chứng từ gốc và số dư hiện tại. completed yêu cầu chứng từ khớp, tổng phiếu không đổi, số đã thu đủ bao gồm khoản đó và paid + due = total; được đối chiếu sau thu thêm hoặc giao máy. Không có chứng từ trả not_found, nội dung/số dư lệch trả conflict; giao diện giữ nguyên yêu cầu. Writer gửi lại dùng chung kiểm tra bằng chứng để không trả thành công khi chứng từ bị lệch dù fingerprint chưa đổi.

Giới hạn: đây là đối chiếu chứng từ thu sửa chữa và số dư phiếu, không phải bằng chứng đã nộp tiền vào quỹ Finance. Chưa có vô hiệu hóa khóa khoản thu ở máy chủ; không xóa một yêu cầu chưa rõ kết quả chỉ dựa trên not_found. Chưa đồng bộ giữa thiết bị/hồ sơ trình duyệt khác. Khi cập nhật frontend cần tránh dùng song song phiên bản cũ chỉ lưu riêng từng tab; bản cũ đang mở chỉ được chuyển khi mở lại form bằng phiên bản mới. Không sửa dữ liệu lịch sử.

Kiểm chứng đợt khoản thu: **641 test kho đạt (38 Node + 603 Vitest, 44 file Vitest)**, tăng 18 ca; 32 test dịch vụ/giao diện sửa chữa liên quan đạt. Typecheck và build frontend/backend đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Hủy an toàn khoản thu và đối chiếu bản lưu xung đột — 2026-09-30

Endpoint quản lý POST /repair/tickets/:id/payments/revoke lưu trạng thái vô hiệu hóa trong RepairPaymentRequest với khóa duy nhất công ty/idempotencyKey, ràng buộc phiếu, chi nhánh, actor và nội dung gốc. Thu tiền và hủy cùng ghi bản khóa trong transaction; hủy thắng chặn khoản thu muộn, thu thắng thì hủy trả completed sau đối chiếu và không đảo tiền. Không tạo chứng từ thu giả cho khóa đã hủy. Dấu khóa không hết hạn; lỗi hoặc nội dung khác rollback toàn bộ, kể cả đối với chứng từ cũ chưa có bản khóa.

Giao diện chỉ bỏ bản lưu sau completed/revoked, cho nhập lại sau revoked và khôi phục kết quả hủy mất phản hồi bằng đối chiếu chỉ đọc. Khi sessionStorage và localStorage khác nhau, hiển thị từng bản để đối chiếu/hủy riêng; không ghi đè hoặc gửi thu thêm. Chỉ xóa đúng bản đã xác minh; giữ bản còn lại, dữ liệu hỏng hoặc trường hợp chưa đủ bằng chứng. Phản hồi muộn không áp lên chi nhánh/người thao tác khác.

Phát hành cần kiểm tra index mới và mọi backend writer phải dùng bản khóa; không quay về writer cũ bỏ qua trạng thái vô hiệu hóa. Chưa triển khai production hoặc sửa dữ liệu lịch sử. Khôi phục vẫn giới hạn cùng hồ sơ trình duyệt; bản cùng khóa nhưng nội dung khác vẫn cần đối soát, không tự đoán nội dung đúng.

Kiểm chứng hủy khoản thu: **659 test kho đạt (38 Node + 621 Vitest, 44 file Vitest)**, tăng 18 ca; **39 test sửa chữa/giao diện liên quan đạt**. Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Lượt hồi quy đầu có một ca stock-movement timeout 5 giây; chạy lại toàn bộ đạt, không đổi timeout/assertion. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Khôi phục yêu cầu tạo phiếu sửa chữa — 2026-09-30

Form tiếp nhận lưu nguyên payload JSON trong localStorage theo công ty/chi nhánh/người thao tác trước khi gọi API. Mã mới dùng tiền tố SRV/WAR cùng UUID; mã khách, receivedAt, coverage.checkedAt và toàn bộ nội dung được cố định ở lần gửi đầu. Mở lại cùng hồ sơ trình duyệt hiển thị yêu cầu đang chờ, khóa sửa nội dung; gửi lại dùng nguyên payload và phạm vi gốc. Đóng cửa sổ không xóa yêu cầu. Không tự tạo mã mới khi nhận lỗi validation, conflict hoặc mất phản hồi.

Web Locks bao quanh đọc/lưu/gửi/đối chiếu/xóa. Tab có bản nháp khôi phục yêu cầu đã lưu bởi tab khác thay vì ghi đè; lỗi lưu hoặc khóa, dữ liệu hỏng đều chặn gửi. Xóa bản lưu chỉ khi API trả đúng phiếu hoặc đối chiếu completed có ticketId, và bản hiện lưu vẫn khớp. Phản hồi muộn không cập nhật UI sau đổi công ty/chi nhánh/tài khoản hoặc đóng form.

Endpoint POST /repair/tickets/reconcile-creation yêu cầu quyền quản lý và chỉ đọc phiếu trong phạm vi hiện tại. Kiểm tra creationFingerprint theo quy tắc tạo phiếu hiện có cùng createdBy; đủ bằng chứng trả completed kể cả phiếu đã chuyển trạng thái, không ghi máy/sự kiện/thông báo. Phiếu cũ thiếu fingerprint hoặc khác nội dung/người tạo trả conflict; không tìm thấy trả not_found và không cho bỏ yêu cầu. Fingerprint hiện có bao gồm tên actor; đổi thông tin tên có thể cần đối soát, không tự đổi quy tắc cho dữ liệu cũ.

Giới hạn: chưa có hủy khóa tạo phiếu bền vững để cho phép bỏ/sửa yêu cầu bị từ chối hoặc chưa rõ kết quả. Chỉ khôi phục cùng hồ sơ trình duyệt còn dữ liệu localStorage, chưa đồng bộ thiết bị. Không phục hồi các lần gửi từ frontend cũ vốn chưa lưu payload. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

Kiểm chứng khôi phục tạo phiếu: **682 test kho đạt (38 Node + 644 Vitest, 45 file Vitest)**, tăng 23 ca (16 giao diện/hook, 7 tích hợp). Nhóm tập trung 49 test và nhóm sửa chữa/giao diện liên quan 40 test đạt. Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Hủy an toàn yêu cầu tạo phiếu — 2026-09-30

Endpoint quản lý POST /repair/tickets/revoke-creation lưu dấu vô hiệu hóa trong RepairCreationRequest, index duy nhất công ty/mã phiếu. Khóa gắn chi nhánh và fingerprint gốc (gồm nội dung/actor), không hết hạn. Tạo và hủy cùng ghi khóa trong transaction bắt buộc: hủy thắng chặn tạo muộn; tạo thắng thì hủy trả completed sau đối chiếu, không hủy phiếu hoặc thay trạng thái máy. Lỗi lưu rollback toàn bộ; gửi lại cùng nội dung không tạo thêm phiếu, máy hoặc thông báo.

Phiếu cũ chưa có khóa vẫn phải khớp fingerprint và actor. Hủy sai nội dung, khác chi nhánh hoặc thiếu bằng chứng rollback cả khóa vừa tạo, không chiếm mã phiếu cũ. Đối chiếu chỉ đọc nhận biết revoked; mất phản hồi hủy có thể khôi phục bằng nút đối chiếu.

Giao diện yêu cầu xác nhận trước khi hủy, giữ nguyên yêu cầu khi chưa rõ kết quả. Chỉ sau revoked mới xóa đúng bản lưu và mở lại nhập liệu; lần tạo mới dùng mã mới. completed mở kết quả phiếu đã có. Đóng cửa sổ không hủy yêu cầu. Không xóa/đổi nội dung trường hợp conflict hoặc not_found.

Phát hành cần kiểm tra index RepairCreationRequest mới và bảo đảm mọi backend writer đều dùng khóa; không rollback về writer cũ bỏ qua dấu vô hiệu hóa. Chưa triển khai production hoặc sửa dữ liệu lịch sử. Dữ liệu lưu hỏng, mất localStorage, nhiều thiết bị và fingerprint lịch sử thiếu/khác vẫn cần đối soát riêng.

Kiểm chứng hủy tạo phiếu: **700 test kho đạt (38 Node + 662 Vitest, 45 file Vitest)**, tăng 18 ca (12 tích hợp, 6 giao diện/hook). Nhóm tập trung 65 test và nhóm sửa chữa/giao diện liên quan 40 test đạt. Typecheck và build frontend/backend đạt; cảnh báo bundle trên 500 kB vẫn còn. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Khôi phục và đối chiếu yêu cầu linh kiện — 2026-09-30

Xuất/hoàn linh kiện lưu nguyên yêu cầu trong localStorage theo công ty/chi nhánh/người thao tác/phiếu trước khi gửi. Xuất giữ khóa, sản phẩm, số lượng, giá và diện chi phí; hoàn giữ partId và lý do (máy chủ hiện dùng khóa hoàn xác định theo phiếu/linh kiện). Web Locks bao quanh lưu/gửi/đối chiếu/xóa, chặn gửi kép và ghi đè yêu cầu tab khác. Yêu cầu chờ khóa nhập mới, khôi phục khi mở lại và vẫn hiển thị trên phiếu đã chốt. Không tự đổi khóa khi sửa input sau lỗi mạng như form cũ.

API được gửi với phạm vi cố định. Callback và tải danh sách muộn không áp sang chi nhánh/phiếu khác. Lỗi hoặc dữ liệu lưu hỏng chặn thao tác, giữ bản lưu. Cả phản hồi ghi thành công lẫn gửi lại đều phải qua đối chiếu trước khi xóa đúng bản lưu; nếu đối chiếu mất phản hồi, giữ nguyên để thử lại chỉ đọc.

Endpoint POST /repair/tickets/:id/parts/reconcile yêu cầu quyền xuất linh kiện, kiểm tra phiếu đúng phạm vi, fingerprint gốc và issuedBy; hoàn kiểm tra partId/lý do/updatedBy. Linh kiện kho phải khớp bút toán xuất gốc, kho/product/variant/SKU, số lượng có dấu, giá vốn và ID liên kết; hoàn phải có thêm bút toán nhập đúng ID/lý do. Linh kiện nhập tay phải có định danh manual phù hợp, không có liên kết ledger. Đối chiếu không ghi kho, tiền hoặc phiếu; thiếu/sai chứng cứ giữ yêu cầu. Replay xuất và hoàn cũng kiểm tra người thao tác; không tự suy actor của dữ liệu cũ.

Giới hạn: chưa có vô hiệu hóa bền vững yêu cầu linh kiện trước khi cho bỏ/sửa nội dung; not_found không cho xóa. Chưa khôi phục yêu cầu từ frontend cũ chưa lưu payload, chưa đồng bộ qua thiết bị. Serial/unit-barcode/lot vẫn không hỗ trợ ở luồng linh kiện này. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

Kiểm chứng khôi phục linh kiện: **720 test kho đạt (38 Node + 682 Vitest, 46 file Vitest)**, tăng 20 ca (9 tích hợp, 11 hook). Nhóm tập trung 51 test và nhóm sửa chữa/giao diện liên quan 42 test đạt, gồm hai ca UI bổ sung về yêu cầu hoàn trên phiếu đã chốt và bản lưu hỏng. Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Hủy an toàn yêu cầu linh kiện — 2026-09-30

Endpoint POST /repair/tickets/:id/parts/revoke dùng quyền xuất linh kiện, lưu RepairPartRequest với index duy nhất công ty/loại thao tác/khóa yêu cầu. Khóa gắn phiếu, chi nhánh, nội dung và actor; không hết hạn. Xuất/hoàn và hủy cùng ghi khóa trong transaction bắt buộc. Hủy thắng chặn ghi kho muộn; ghi kho thắng thì hủy chỉ trả completed sau đối chiếu chứng từ/bút toán, không đảo tồn, giá vốn hay tiền phiếu.

Yêu cầu hoàn mới có idempotencyKey riêng, ghi returnRequestKey trên dòng linh kiện. Khóa bút toán hoàn vẫn duy nhất theo phiếu/linh kiện nên không nhập kho hai lần. Bản chờ cũ thiếu khóa dùng nhánh legacy ổn định, không tự gán mã mới; sau khi hủy thành công có thể nhập lại bằng khóa mới. Hoàn trong transaction hủy phiếu dùng nhánh khóa nội bộ riêng, không bị kẹt bởi yêu cầu hoàn của người dùng đã vô hiệu hóa.

Hủy sai nội dung/actor/phạm vi, chứng từ cũ thiếu bằng chứng hoặc bút toán mồ côi bị từ chối và rollback khóa vừa tạo. Đối chiếu chỉ đọc nhận biết revoked; bản cũ đã hủy vẫn nhận revoked sau khi một yêu cầu mới hoàn đúng linh kiện. Lỗi lưu dấu hủy rollback; không chấp nhận session ngoài transaction.

Giao diện có xác nhận Hủy yêu cầu linh kiện. Chỉ completed/revoked mới xóa đúng bản lưu; revoked mở lại nhập liệu, completed cập nhật phiếu. Mất phản hồi có thể phục hồi bằng đối chiếu, còn not_found/conflict vẫn giữ nguyên yêu cầu. Phát hành cần index mới và mọi writer cùng kiểm tra khóa; không chạy backend cũ bỏ qua dấu hủy. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

Kiểm chứng hủy linh kiện: **744 test kho đạt (38 Node + 706 Vitest, 46 file Vitest)**, tăng 24 ca (17 tích hợp, 7 hook). Nhóm tập trung 69 test, nhóm vòng đời/tiền/giao diện 88 test và nhóm sửa chữa/giao diện cuối 43 test đạt; có thêm một ca UI hủy bản hoàn cũ rồi sinh khóa mới. Typecheck và build frontend/backend đạt; còn cảnh báo bundle trên 500 kB. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — khôi phục thu công nợ bán lẻ qua phiên và nhiều tab

- CollectionDialog lưu yêu cầu vào localStorage theo công ty/chi nhánh/người dùng/đơn. Giữ nguyên khóa, expectedVersion và chi tiết thanh toán khi thử lại; khóa Web Locks bao trùm đọc/lưu/gửi/dọn bản lưu.
- Chuyển bản sessionStorage cũ khi thử lại: ghi và xác minh bản dùng chung trước khi xóa bản cũ. Dữ liệu hỏng hoặc hai bản khác nhau chặn gửi và giữ dữ liệu; không tự chọn hoặc sinh khóa thay thế.
- Biểu mẫu cũ phát hiện yêu cầu tab khác phải hiển thị yêu cầu đó và chờ thao tác thử lại. Phản hồi muộn không gọi callback sau đổi phạm vi/đóng cửa sổ; dọn bản lưu chỉ khi còn khớp yêu cầu. Không có Web Locks hoặc không lưu được thì không gửi.
- Đơn hoàn tất/hủy vẫn mở được màn hình khoản thu đang chờ. Khi không có yêu cầu cũ, không mở biểu mẫu thu mới trên đơn không đủ điều kiện.
- Nghiệm thu: 15 kiểm thử CollectionDialog; toàn bộ inventory đạt 756 (38 Node + 718 Vitest, 46 file). Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu. Chưa triển khai production hoặc thay dữ liệu lịch sử.
- Giới hạn: chỉ cùng hồ sơ trình duyệt; bản sessionStorage cũ chưa được chuyển nếu người dùng chưa thử lại. Thao tác thử lại vẫn là POST thu có idempotency, chưa phải đối chiếu chỉ đọc. Xung đột/corrupt storage cần giữ để xử lý, chưa có chức năng hủy khóa thu bán lẻ.

### Bổ sung 2026-09-30 — đối chiếu chỉ đọc khoản thu bán lẻ

- API POST /retail/orders/:id/payments/reconcile chỉ đọc trong transaction snapshot. Kiểm tra công ty, chi nhánh, đơn, người thu, ca, khóa và fingerprint dùng chung với writer; không sửa đơn, khóa hoặc phát sự kiện thu.
- Writer lưu collectionEvidence (vị trí dòng thanh toán, số đã thu trước giao dịch, tổng đơn) cùng transaction. Đối chiếu khớp đoạn thanh toán/phương thức/tiền khách đưa/tiền thừa/tham chiếu/người thu/ca, tổng các dòng với paidAmount và phiên bản tối thiểu. Các khoản thu tiếp theo vẫn cho phép xác minh khoản trước.
- Bốn kết quả: completed, not_found, processing, conflict. Dữ liệu lịch sử thiếu bằng chứng không được tự bổ sung hay tự xác nhận; đường replay POST cũ giữ tương thích. not_found không có nghĩa yêu cầu đang gửi đã bị hủy.
- UI có nút Đối chiếu khoản thu, giữ khóa và payload khi chưa xác minh hoặc lỗi mạng. Chỉ dọn bản lưu còn khớp sau completed có đúng đơn; Web Locks và kiểm tra phạm vi bảo vệ callback. Phản hồi API lọc giá vốn theo quyền hiện hành.
- Nghiệm thu: 774 kiểm thử inventory đạt (38 Node + 736 Vitest, 47 file), gồm 20 kiểm thử giao diện thu nợ. Typecheck và build frontend/backend đạt, vẫn có cảnh báo bundle >500 kB hiện hữu.
- Đây là xác minh khoản thu trên đơn, chưa đối soát tiền thực/quỹ Finance. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — hủy khóa thu bán lẻ và xử lý bản lưu xung đột

- API POST /retail/orders/:id/payments/revoke ghi trạng thái revoked bền vững trong RetailIdempotency. Dùng cùng fingerprint và chỉ mục duy nhất companyCode/key với writer thu nợ: thu và hủy cùng khóa không thể cùng thành công. Không xóa marker hoặc tái sử dụng khóa.
- Chỉ tạo marker khi đơn confirmed còn đúng expectedVersion và chưa có hồ sơ yêu cầu. Đã completed/processing, sai phạm vi/người thu/payload hoặc đơn đã thay đổi đều từ chối. Yêu cầu revoked đúng nội dung được trả lại kết quả cũ; collect từ chối COLLECTION_REVOKED, đối chiếu chỉ đọc trả revoked.
- UI thêm Hủy yêu cầu chưa ghi nhận; chỉ xóa bản lưu sau máy chủ xác nhận revoked/completed. Mất phản hồi vẫn giữ nguyên yêu cầu để thử lại/đối chiếu. Hai bản localStorage/sessionStorage hợp lệ nhưng khác nhau được chọn và xử lý riêng; không thể retry thu khi còn cả hai, không ghi đè bản còn lại.
- Nghiệm thu: 788 kiểm thử inventory đạt (38 Node + 750 Vitest, 47 file), gồm 26 kiểm thử giao diện thu công nợ. Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: bản lưu hỏng vẫn chặn; yêu cầu phiên bản cũ thiếu hồ sơ hoặc thiếu bằng chứng cần đối chiếu thủ công, không tự hủy. Hủy khóa không hoàn tiền và không hủy đơn. Vẫn chỉ cùng hồ sơ trình duyệt, chưa đối soát quỹ Finance/tiền thực. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — khôi phục yêu cầu hủy đơn qua phiên và nhiều tab

- CancelDialog lưu yêu cầu trong localStorage theo công ty/chi nhánh/người dùng/đơn, giữ nguyên khóa, expectedVersion, lý do, phương thức, số tiền và tham chiếu hoàn tiền khi thử lại. Web Locks bao trùm đọc/lưu/gửi/dọn dữ liệu.
- Bản sessionStorage cũ chỉ được xóa khi thử lại đã ghi và xác minh bản dùng chung. Dữ liệu hỏng, bản chung khác bản cũ, mất khả năng lưu hoặc không có khóa trình duyệt đều chặn gửi. Không tự ghi đè yêu cầu khác.
- Biểu mẫu mở trước phát hiện yêu cầu tab khác sẽ hiển thị nội dung cũ và yêu cầu bấm thử lại. Callback lỗi/thành công đến sau đổi phạm vi/đóng cửa sổ không cập nhật giao diện; dọn bản lưu phải còn khớp.
- Đơn cancelled vẫn mở được Kiểm tra yêu cầu hủy đang chờ; nếu không có yêu cầu cũ thì không cho tạo yêu cầu hủy mới. Giao diện hiển thị các dòng tiền hoàn đã lưu.
- Nghiệm thu: 802 kiểm thử inventory đạt (38 Node + 764 Vitest, 47 file), gồm 17 kiểm thử CancelDialog. Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: cùng hồ sơ trình duyệt; bản sessionStorage cũ cần thử lại để chuyển sang lưu chung. Đây vẫn là POST hủy có idempotency, chưa phải đối chiếu chỉ đọc. Hai bản khác nhau và dữ liệu hỏng được giữ để đối chiếu. Đơn nháp bị xóa sau hủy chưa có danh sách yêu cầu đang chờ độc lập để mở lại. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — đối chiếu hủy đơn và khôi phục đơn nháp đã xóa

- API POST /retail/orders/:id/cancel/reconcile chỉ đọc hồ sơ trong transaction snapshot. Fingerprint dùng chung với writer, ràng buộc công ty/chi nhánh/đơn/người thao tác/ca/phiên bản/lý do/refunds. Giữ kiểm tra quyền quản lý đối với đơn hoàn tất, quyền chủ đơn nháp và lọc giá vốn ở controller.
- Writer lưu cancellationDigest cùng transaction cho các trường trạng thái/phiên bản/hủy/tiền hoàn/tham chiếu nhập lại. Đối chiếu yêu cầu digest còn khớp; đơn nháp đã hủy phải có snapshot đúng và không còn đơn sống. Đơn đã xác nhận phải khớp tổng hoàn/đã thu, hóa đơn void và phiếu nhập lại confirmed đúng phạm vi/source nếu có xuất kho. Không sửa/bổ sung dữ liệu cũ thiếu bằng chứng.
- CancelDialog có nút đối chiếu riêng; chỉ dọn bản lưu khớp sau completed có đúng đơn. Kết quả not_found/processing/conflict, lỗi mạng hoặc sai đơn đều giữ yêu cầu.
- Trang đơn hàng có danh sách Yêu cầu hủy đang chờ trên trình duyệt, đọc cả localStorage/sessionStorage đúng người dùng và phạm vi. Có thể đối chiếu bản nháp đã bị xóa mà không cần tải chi tiết đơn; hỗ trợ tải lại, storage/focus refresh, Web Locks và chặn callback sau đổi phạm vi/unmount.
- Nghiệm thu hồi quy: 824 kiểm thử inventory đạt (38 Node + 786 Vitest, 47 file). Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: xác minh hồ sơ hủy/hoàn tiền và liên kết chứng từ, chưa đối soát toàn bộ ledger/serial, tiền thực hoặc quỹ Finance. Hồ sơ lịch sử thiếu digest, dữ liệu hỏng hoặc hai bản lưu khác nhau vẫn giữ để xử lý. Danh sách độc lập hiện chỉ đối chiếu, chưa có hủy khóa hoặc retry writer trực tiếp. Không triển khai production hoặc thay dữ liệu lịch sử.

### Bổ sung 2026-09-30 — thu hồi yêu cầu hủy đơn và xử lý bản lưu xung đột

- API POST /retail/orders/:id/cancel/revoke ghi marker revoked bền vững bằng cùng unique companyCode/key và fingerprint của writer hủy đơn. Chỉ tạo khi đơn còn tồn tại, đúng expectedVersion và chưa có hồ sơ yêu cầu. Yêu cầu đã completed/processing hoặc thiếu bằng chứng trên đơn đã đổi không thể thu hồi.
- Giữ quyền quản lý với đơn completed và quyền chủ đơn nháp. Marker lưu cancelledFromStatus/cancellationOwnerId để kiểm tra lại quyền khi replay/đối chiếu sau mất quyền quản lý. Writer cancel từ chối CANCELLATION_REVOKED; đối chiếu trả revoked và không ghi dữ liệu.
- CancelDialog có Thu hồi yêu cầu chưa ghi nhận. Danh sách PendingCancellations hiển thị riêng từng bản localStorage/sessionStorage khác nhau; đối chiếu/thu hồi từng bản dưới Web Locks, chỉ xóa bản còn khớp sau xác nhận completed/revoked. Không ghi đè hoặc xóa bản còn lại, lỗi mạng vẫn giữ yêu cầu.
- Nghiệm thu hồi quy: 836 kiểm thử inventory đạt (38 Node + 798 Vitest, 47 file). Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: dữ liệu hỏng và phiên bản cũ thiếu bằng chứng vẫn phải đối chiếu thủ công. Thu hồi không khôi phục đơn đã hủy, không hoàn/thu tiền. Chỉ cùng hồ sơ trình duyệt. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — khôi phục hậu mãi qua phiên và nhiều tab

- useAfterSaleRequest lưu nguyên yêu cầu trả hàng/thu mua lại vào localStorage theo công ty/chi nhánh/người dùng/đơn. Web Locks bao trùm đọc/lưu/gửi/dọn bản lưu; bản sessionStorage cũ chỉ bị xóa sau khi ghi và xác minh bản chung lúc thử lại.
- Kiểm tra cấu trúc bản lưu (nghiệp vụ, đơn, khóa, lý do, phương thức, dòng/số lượng/giá/tình trạng/mã máy). Bản hỏng, bản chung khác bản cũ, lỗi lưu hoặc thiếu khóa trình duyệt chặn gửi. So sánh nội dung không phụ thuộc thứ tự thuộc tính JSON và không thay payload gốc.
- Biểu mẫu cũ gặp yêu cầu tab khác phải nhận và hiển thị nội dung cũ, chưa tự gửi. Giữ giá thu mua, ghi chú, tham chiếu, serial/barcode; vẫn chặn dùng yêu cầu return cho buyback hoặc ngược lại. Phản hồi lỗi/thành công sau đổi phạm vi/unmount không gọi tiếp xử lý UI; dọn bản lưu chỉ khi còn khớp.
- Đơn hoàn tất đã xử lý hết hàng vẫn có lối mở yêu cầu trả/thu mua cũ. Form cho retry bản lưu nhưng không cho tạo yêu cầu mới khi tất cả hàng đã xử lý; có phần hiển thị nội dung yêu cầu đã lưu và đồng bộ trường form khi nhận bản từ tab khác.
- Nghiệm thu hồi quy: 850 kiểm thử inventory đạt (38 Node + 812 Vitest, 47 file), gồm 24 kiểm thử hook/form hậu mãi. Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: cùng hồ sơ trình duyệt; bản sessionStorage cũ cần thử lại để chuyển. Đây vẫn là writer replay có idempotency, chưa phải đối chiếu chỉ đọc. Bản lưu xung đột/hỏng vẫn giữ để xử lý. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — đối chiếu hậu mãi chỉ đọc

- API POST /retail/after-sales/reconcile đọc transaction snapshot, dùng chung fingerprint/chuẩn hóa với writer (phạm vi/người thao tác/ca/khóa/đơn/nghiệp vụ/dòng hàng/thanh toán/lý do). Không ghi phiếu, kho, tiền hoàn hoặc sự kiện khi đối chiếu.
- Writer lưu reconciliationEvidence cùng transaction: digest nội dung phiếu và dòng hàng, phiên bản đơn sau ghi, vị trí dòng hoàn tiền cho return. Đối chiếu kiểm tra digest, tổng tiền dòng, phiên bản tối thiểu và phiếu nhập confirmed đúng phạm vi/sourceId. Return còn kiểm tra dòng hoàn tiền, người hoàn, phương thức/tham chiếu/ca/lý do và tổng hoàn trên đơn; phiếu tiếp theo không làm mất khả năng xác minh phiếu trước.
- Buyback chỉ xác minh phiếu và nhập hàng, không tuyên bố đã kiểm chứng tiền thực/quỹ Finance. Trả về thông tin chứng từ tối thiểu (_id/code/orderId/type/receipt), không trả dòng giá vốn/metadata nội bộ.
- Hook/form có Đối chiếu yêu cầu hậu mãi riêng với writer retry, giữ Web Locks và bản lưu nguyên vẹn khi not_found/conflict/lỗi mạng/kết quả sai đơn hoặc sai nghiệp vụ. Chỉ dọn bản lưu khớp sau completed; callback muộn vẫn bị chặn theo phạm vi/mount.
- Nghiệm thu hồi quy: 864 kiểm thử inventory đạt (38 Node + 826 Vitest, 47 file). Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Giới hạn: phiếu lịch sử thiếu evidence giữ để đối chiếu, không backfill. Chưa đối soát đầy đủ ledger/serial hoặc quỹ Finance/tiền thực. Chưa có thu hồi khóa hậu mãi hoặc xử lý riêng hai bản lưu xung đột. Không triển khai production hoặc sửa dữ liệu lịch sử.

### Bổ sung 2026-09-30 — thu hồi khóa hậu mãi và bản lưu xung đột

- Thêm RetailAfterSaleRequestModel, unique companyCode/idempotencyKey, trạng thái processing/completed/revoked và documentId. Writer ghi gate và phiếu/kho/hoàn tiền cùng transaction; gate completed thiếu/sai phiếu chặn tạo lại. Phiếu lịch sử vẫn replay tương thích, nhưng không thể bị thu hồi.
- API POST /retail/after-sales/revoke dùng chung fingerprint và gate với writer. Tạo phiếu và thu hồi cùng khóa không thể cùng thành công. Đã có phiếu/gate hoàn tất hoặc có dấu vết hậu mãi trên đơn (hoàn tiền, trạng thái, phiếu hậu mãi/nhập hàng) thì từ chối tạo marker thu hồi. Không tạo phiếu giả để giữ khóa; đối chiếu chỉ đọc nhận diện revoked.
- UI cho chọn từng bản local/session khác nhau, chặn writer retry khi còn xung đột, đối chiếu/thu hồi từng bản dưới Web Locks. Chỉ dọn bản còn khớp sau completed/revoked; bản kia và lỗi mạng vẫn được giữ. Có thể xử lý cả return/buyback trong cùng cửa sổ qua nút chọn yêu cầu.
- Nghiệm thu hồi quy: 875 kiểm thử inventory đạt (38 Node + 837 Vitest, 47 file); 2 kiểm thử tích hợp điểm khách hàng liên quan đạt. Typecheck và build frontend/backend đạt; vẫn có cảnh báo bundle >500 kB hiện hữu.
- Khi phát hành phải triển khai đồng bộ tất cả writer hậu mãi và xác minh chỉ mục unique của gate mới trước khi bật thu hồi; không để writer cũ bỏ qua gate tiếp tục chạy. Chưa chạy tạo chỉ mục/migration trên production.
- Giới hạn: chính sách thu hồi đang bảo thủ, chưa thu hồi khóa mới trên đơn đã có lịch sử hậu mãi dù có thể là yêu cầu khác; cần thêm phiên bản đơn/bằng chứng nền trước khi mở rộng. Phiếu/mã lịch sử mồ côi, dữ liệu hỏng và tiền thực/quỹ Finance vẫn cần đối chiếu riêng. Không triển khai production hoặc sửa lịch sử.

### Bổ sung 2026-09-30 — phiên bản đơn và bằng chứng nền hậu mãi

- Yêu cầu hậu mãi mới gửi expectedVersion và ràng buộc phiên bản vào fingerprint v2. Máy chủ từ chối tạo/thu hồi khi phiên bản đã thay đổi; phát lại yêu cầu đã ghi nhận vẫn trả kết quả cũ. Hai khóa mới trên cùng phiên bản không cùng ghi nhận.
- Yêu cầu cũ không có expectedVersion giữ nguyên fingerprint v1; thử lại bản lưu không tự thêm hoặc thay phiên bản. Chính sách thu hồi bảo thủ vẫn áp dụng cho yêu cầu cũ.
- Cho phép thu hồi yêu cầu mới chưa ghi nhận trên đơn đã có trả hàng/thu mua khi đúng phiên bản và toàn bộ lịch sử có bằng chứng khớp: phiếu hậu mãi, digest, gate hoàn tất, phiếu nhập xác nhận cùng SKU/số lượng/giá vốn, từng dòng hoàn tiền và tổng hoàn. Thiếu/sai/mồ côi bị từ chối; gate thu hồi lưu baselineDigest. Không sửa hay tạo bù chứng từ lịch sử.
- Nghiệm thu: 889 kiểm thử inventory đạt (38 Node + 851 Vitest, 47 file), gồm 14 ca mới. Typecheck và build frontend/backend đạt; cảnh báo bundle >500 kB hiện hữu còn nguyên.
- Giới hạn: bằng chứng chứng từ không thay đối soát ledger/serial đầy đủ hoặc tiền thực/quỹ Finance. Dữ liệu cũ thiếu gate/bằng chứng vẫn cần xử lý riêng. Chưa triển khai production/migration; vẫn phải xác minh unique index và triển khai đồng bộ mọi writer trước phát hành.

### Bổ sung 2026-09-30 — khôi phục yêu cầu nháp POS qua phiên/tab

- Yêu cầu tạo/sửa nháp lưu nguyên khóa và payload trong localStorage theo công ty/chi nhánh/tài khoản/đơn. Bản sessionStorage cũ chỉ được xóa sau khi lưu chung đã kiểm chứng. Bản hỏng, thiếu phạm vi hoặc xung đột giữa hai nơi lưu đều chặn gửi; không chọn đè một bản. Dấu cho phép sửa từ tab cũ không mở khóa yêu cầu chung đang chưa rõ kết quả.
- Web Locks giữ từ lúc đọc/lưu yêu cầu qua API và cập nhật hàng đợi đến dọn bản lưu; áp dụng cho treo đơn, checkout, khôi phục và đồng bộ offline. Thiếu khóa hoặc tab khác đang thao tác thì từ chối gửi. Dọn chỉ bản còn khớp; bản thay thế được giữ nguyên.
- POS hiển thị yêu cầu nháp chưa rõ kết quả và nút khôi phục nguyên yêu cầu cũ, kể cả phiên bản sửa đơn. Khôi phục chỉ gọi lưu nháp, không xác nhận thanh toán. Phản hồi thiếu ID/version hoặc sai ID đơn sửa không được dọn yêu cầu. Phản hồi đến muộn không cập nhật giao diện tài khoản/chi nhánh khác.
- Đồng bộ offline đối chiếu yêu cầu với bản lưu chung trước khi gửi; xung đột giữ cả bản hàng đợi lẫn bản trình duyệt. Chỉ cập nhật hàng đợi với ID/version phản hồi hợp lệ và lưu thành công trước khi confirm. Không tự lấy phiên bản mới hoặc tạo đơn thay thế.
- Nghiệm thu: 912 kiểm thử inventory đạt (38 Node + 874 Vitest, 48 file), gồm 23 ca mới; 18 kiểm thử POS/hàng đợi liên quan đạt. Typecheck và build frontend/backend đạt, cảnh báo bundle >500 kB hiện hữu còn nguyên. Không triển khai production/migration.
- Giới hạn: khôi phục cùng hồ sơ trình duyệt, chưa đồng bộ thiết bị; các tab frontend cũ không tuân thủ khóa nên phải nâng cấp đồng bộ. Bản lưu xung đột vẫn cần đối chiếu, chưa có API đối chiếu chỉ đọc/thu hồi khóa nháp. Checkout trực tuyến vẫn cần lưu bền toàn bộ ý định xác nhận trước khi gửi để bao phủ đóng tab giữa chừng; không coi lưu nháp là chứng minh đã thanh toán.

### Bổ sung 2026-09-30 — lưu bền yêu cầu xác nhận POS trước khi gửi

- Checkout lưu toàn bộ ý định vào IndexedDB trước API đầu tiên: khóa xác nhận, payments, expectedGrandTotal, yêu cầu tạo/sửa nháp cùng khóa và phiên bản gốc. Sau phản hồi lưu nháp hợp lệ, ghi ID/version vào cùng hàng đợi trước confirm. Mọi thao tác nằm trong khóa công ty/chi nhánh/tài khoản dùng chung với đồng bộ.
- Các thao tác IndexedDB put/claim/update/remove chỉ hoàn tất khi transaction commit; request thành công nhưng transaction abort vẫn báo lỗi. Cập nhật dòng không tồn tại bị từ chối. Thiếu IndexedDB hoặc không lưu được ý định thì POS không gửi thanh toán, không dùng bộ nhớ tạm thay thế cho checkout.
- Lỗi API hoặc lỗi ghi trạng thái hoàn tất giữ nguyên ý định, khóa và nội dung. POS bỏ giỏ đang chờ khỏi màn hình để tránh tạo giao dịch thay thế, nhưng không xóa yêu cầu. Bỏ đường tự động hủy draft khi thanh toán lỗi. Có yêu cầu chưa hoàn tất trong cùng phạm vi thì chặn checkout mới; xử lý tại mục đồng bộ.
- Khôi phục trạng thái syncing đối chiếu idempotency trước: completed phải có ID đơn/hóa đơn phù hợp, processing/không rõ/lỗi mạng tiếp tục giữ nguyên, chỉ not_found cho gửi lại nguyên yêu cầu. Thử lại thủ công chuyển về syncing để đối chiếu trước. Đồng bộ và checkout dùng chung Web Lock, không tranh ghi hàng đợi giữa các tab.
- Giao diện đổi tên mục thành yêu cầu thanh toán, không cho xóa yêu cầu chưa có kết quả cuối. Có thể thử lại yêu cầu pending/syncing/failed; không tự sửa giá, payments hoặc version của ý định cũ. Đối chiếu hiện dựa trên endpoint idempotency đã có và kiểm tra liên kết ID phản hồi; chưa bổ sung endpoint đối chiếu fingerprint toàn payload riêng.
- Nghiệm thu: 951 kiểm thử đạt (38 Node + 913 Vitest, 53 file), gồm các bộ POS/hàng đợi được đưa vào runner chung. Có 20 ca mới về lưu trước gửi, mất phản hồi, commit/abort IndexedDB, trạng thái chưa rõ và UI không tự hủy/xóa. Typecheck và build frontend/backend đạt; cảnh báo bundle >500 kB hiện hữu còn nguyên. Không triển khai production hoặc migration.
- Giới hạn: yêu cầu bị từ chối nghiệp vụ vẫn giữ nguyên và chặn checkout mới trong phạm vi tài khoản/chi nhánh; cần thêm thu hồi server an toàn trước khi cho sửa/bỏ. Dữ liệu đã mất trước bản nâng cấp không thể tự khôi phục. Chưa đồng bộ thiết bị, đối soát Finance/tiền thực hoặc chứng minh lại toàn bộ payload qua endpoint chỉ đọc mới.

### Bổ sung 2026-09-30 — đối chiếu và thu hồi ý định thanh toán POS

- Thêm POST /retail/orders/checkout/reconcile và /checkout/revoke với quyền vận hành hiện có, phạm vi máy chủ và actor xác thực. Đối chiếu dùng transaction snapshot chỉ đọc, kiểm tra fingerprint xác nhận v1 nguyên bản (đơn, phiên bản, tổng tiền, payments chuẩn hóa, actor) và bằng chứng khóa tạo/sửa nháp nếu ý định có lưu yêu cầu nháp.
- Kết quả completed yêu cầu liên kết đơn/hóa đơn gốc, tổng và từng khoản trên snapshot hóa đơn, các khoản đầu tiên trên đơn, người nhận và tổng paidAmount khớp. Sai actor/chi nhánh/nội dung, thiếu gate hoặc chứng từ không khớp đều giữ yêu cầu; không lấy chỉ trạng thái khóa làm bằng chứng hoàn tất. Fingerprint confirm v1 cũ được giữ nguyên.
- Thu hồi ghi marker operation revoke-checkout trong RetailIdempotency với cùng unique company/key mà writer xác nhận đang dùng. Nếu tạo/sửa nháp chưa ghi nhận, đặt thêm marker revoked cho khóa nháp trong cùng transaction để chặn yêu cầu nháp đến muộn. Nếu đã lưu nháp nhưng mất phản hồi, xác định đơn/phiên bản qua gate nháp gốc. Giữ bản nháp đã lưu; không hủy đơn hay hoàn tiền.
- Khi confirm thắng, thu hồi trả completed sau đối chiếu thay vì đảo nghiệp vụ. Khi thu hồi thắng, writer confirm bị từ chối qua gate chung; create/update nháp chưa ghi nhận cũng bị chặn. Lỗi ghi marker rollback cả hai khóa. Chỉ thu hồi trên draft đúng phiên bản, chưa có tiền/kho/hóa đơn; trường hợp tiến triển hoặc thiếu bằng chứng không được suy đoán.
- Giao diện có nút Đối chiếu/Thu hồi yêu cầu và hiển thị mã đơn/tổng tiền nếu đã biết. Kết quả cuối mới dọn đúng bản nháp tương ứng và đánh dấu hàng đợi synced/revoked dưới Web Lock; bản lưu khác hoặc phản hồi đến muộn không bị xóa. Mất phản hồi thu hồi có thể khôi phục qua đối chiếu chỉ đọc. Checkout mới được phép sau revoked; trạng thái revoked không được đồng bộ gửi lại.
- Nghiệm thu: 981 kiểm thử đạt (38 Node + 943 Vitest, 54 file), gồm 30 ca mới. Typecheck và build frontend/backend đạt; cảnh báo bundle >500 kB hiện hữu còn nguyên. Không triển khai production/migration.
- Phát hành cần xác minh unique company/key hiện có và triển khai đồng bộ các writer/client giữ luật kiểm tra operation/fingerprint/status; không dùng writer cũ bỏ qua gate. Bằng chứng này không thay đối soát ledger/serial đầy đủ hoặc quỹ Finance/tiền thực. Yêu cầu malformed, trạng thái đơn đã tiến triển, dữ liệu lịch sử thiếu/hỏng và bản local/session xung đột vẫn phải giữ để xử lý riêng.

### Bổ sung 2026-09-30 — đối chiếu/thu hồi nháp độc lập và bản lưu xung đột

- Thêm POST /retail/orders/draft-requests/reconcile và /draft-requests/revoke, cùng quyền vận hành và phạm vi xác thực hiện có. Dùng fingerprint tạo/sửa nháp nguyên bản để kiểm tra operation, actor, chi nhánh, đơn và nội dung. Đối chiếu dùng transaction snapshot chỉ đọc, không gọi lại writer hoặc ghi đè nội dung đơn.
- Gate completed cùng chứng từ còn tồn tại chứng minh lần lưu gốc ngay cả khi đơn đã sửa tiếp/thanh toán; trả metadata ID/version/status hiện tại, không trả giá vốn. Thiếu chứng từ hoặc phiên bản thấp hơn kết quả lần lưu vẫn bị từ chối. Thu hồi yêu cầu đã hoàn tất trả completed và giữ đơn nguyên trạng.
- Khóa chưa ghi nhận được đặt revoked trên cùng unique company/key với writer. Yêu cầu sửa chỉ thu hồi khi đơn còn draft đúng phiên bản, chưa có tiền/kho/hóa đơn. Khóa tạo/sửa đến muộn bị chặn, tranh chấp unique được đọc lại trong transaction; không tạo đơn thay thế. Checkout có khóa nháp đã thu hồi độc lập có thể thu hồi nốt khóa xác nhận để không mắc kẹt hàng đợi.
- PendingDraftRequests hiển thị riêng bản lưu chung và bản tab cũ. Khi xung đột, chặn nút phát lại writer nhưng vẫn cho đối chiếu/thu hồi từng bản. Sau completed/revoked chỉ dọn nội dung còn khớp; bản còn lại, bản thay thế và cùng khóa khác payload đều được giữ. Phản hồi đến muộn không cập nhật phạm vi đã đổi.
- Nghiệm thu: 1.005 kiểm thử đạt (38 Node + 967 Vitest, 54 file), gồm 24 ca mới (15 backend và 9 UI). Typecheck và build frontend/backend đạt; cảnh báo bundle >500 kB hiện hữu còn nguyên. Không triển khai production/migration.
- Giới hạn: bản malformed, cùng khóa khác nội dung không khớp gate, đơn đã mất hoặc cập nhật chưa ghi nhận nhưng phiên bản đơn đã tiến triển vẫn cần đối chiếu riêng. Chưa đồng bộ qua thiết bị hoặc phục dựng lịch sử thiếu bằng chứng. Phát hành cần giữ unique company/key và tất cả writer tuân thủ gate hiện có.

### Bổ sung 2026-09-30 — hàng đợi kiểm kê theo phạm vi và khóa giữa các tab

- Bản chờ mới lưu riêng theo công ty/chi nhánh/người dùng, dùng khóa JSON tuple để tránh trùng phạm vi. Giữ nguyên khóa legacy igen.inventory-count.pending, không tự gán chủ sở hữu hoặc phát lại; giao diện thông báo cần đối chiếu riêng. JSON hỏng, sai cấu trúc hoặc số lượng không hợp lệ chặn ghi/xóa thay vì bị xem là hàng đợi rỗng; bản thiếu phiên bản được giữ và báo xung đột.
- Lưu và kiểm tra bản chờ trước PATCH, giữ expectedVersion gốc cả khi mất phản hồi lúc vẫn online. Phiếu còn bản chờ không được ghi đè bằng số đếm/phiên bản mới. Đồng bộ, cập nhật, tải lại và bỏ bản chờ dùng cùng Web Lock theo phạm vi; thiếu hỗ trợ hoặc tab khác giữ khóa thì dừng thao tác.
- PATCH và tải lại gửi x-branch-id đã chốt; hàng đợi không tự refresh phiên rồi phát lại khi gặp 401. Kiểm tra token/phạm vi trước và sau yêu cầu; đổi tài khoản/chi nhánh hoặc đóng màn hình dừng các bước sau và giữ bản chờ. Modal khởi tạo lại theo phạm vi/kho, phản hồi cũ không thay dữ liệu màn hình mới hay gọi callback hoàn tất.
- Đồng bộ chỉ xóa nội dung còn khớp sau thành công. Tải lại lấy snapshot bản chờ, chỉ xóa đúng snapshot sau GET thành công và phạm vi còn hiệu lực; lỗi mạng hoặc bản thay thế trong lúc chờ được giữ. Không tự nâng phiên bản để áp số đếm cũ.
- Nghiệm thu: 1.025 kiểm thử đạt (38 Node + 987 Vitest, 55 file); 19 ca mới và thêm 1 ca apiFetch hiện có vào runner chung. 34 ca tập trung đạt; typecheck và build frontend/backend đạt. Cảnh báo bundle >500 kB hiện hữu còn nguyên. Không triển khai production/migration.
- Giới hạn: cần trình duyệt hỗ trợ Web Locks và cập nhật đồng bộ các tab/client. Bản chờ còn phụ thuộc dữ liệu trình duyệt; mất phản hồi PATCH có thể cần đối chiếu thủ công vì chưa có bằng chứng idempotency cho lần đếm. Dữ liệu legacy/hỏng chỉ được giữ và báo, chưa có màn hình xem/xuất/giải quyết; không suy đoán chủ sở hữu hoặc đồng bộ sang thiết bị khác.

### Bổ sung 2026-09-30 — xem, xuất và đối chiếu bản chờ kiểm kê

- Thêm InventoryCountPendingPanel trong màn hình kiểm kê: liệt kê bản chờ của tài khoản/chi nhánh hiện tại trên toàn bộ kho, hiển thị mã phiếu/dòng, số đếm đã lưu và phiên bản gốc. Đối chiếu chỉ GET phiếu bằng chi nhánh đã chốt, không gọi PATCH, không xóa bản chờ hoặc tự áp số đếm lên phiên bản mới. Số lượng trùng nhau không được coi là bằng chứng đã hoàn tất.
- Kiểm tra bản chờ còn khớp, token và phạm vi trước/sau GET; kết quả sai phiếu, bản thay thế, lỗi mạng hoặc đổi phiên bị từ chối nhưng dữ liệu được giữ. UI hiển thị riêng dòng không còn trên máy chủ và phiên bản gốc sai định dạng, không suy đoán số lượng bằng 0. Phản hồi đến muộn bị bỏ qua khi đổi phạm vi, đóng panel hoặc cập nhật storage.
- Dữ liệu hiện tại bị hỏng và dữ liệu legacy chưa rõ chủ sở hữu có vùng xem nguyên văn và xuất file text nguyên gốc. Không tự gán tài khoản/chi nhánh, không nhập lại hay phát lại legacy. Xuất dữ liệu không xóa hoặc sửa storage.
- Panel cập nhật khi storage thay đổi ở tab khác hoặc khi hàng đợi ghi trong cùng tab. Sau đồng bộ, danh sách phiếu được đọc lại; số thứ tự yêu cầu và so sánh phiên bản ngăn phản hồi danh sách cũ ghi đè dữ liệu mới.
- Nghiệm thu: 1.042 kiểm thử đạt (38 Node + 1.004 Vitest, 56 file), gồm 17 ca mới. 49 kiểm thử tập trung, typecheck và build frontend/backend đạt. Cảnh báo bundle >500 kB vẫn còn; InventoryTab khoảng 501 kB trước gzip. Không triển khai production/migration.
- Giới hạn: đối chiếu này cung cấp snapshot để con người so sánh, chưa chứng minh một PATCH mất phản hồi đã ghi nhận. Dữ liệu legacy/hỏng vẫn cần phục hồi thủ công; chưa có cơ chế nhập lại, gán chủ sở hữu hoặc giải quyết tự động. Không đồng bộ qua thiết bị.

### Bổ sung 2026-09-30 — bằng chứng và xác minh lần lưu số đếm

- Thêm InventoryCountRequest với unique companyCode/requestId, không TTL. Yêu cầu mới dùng UUID v4 đã lưu trên trình duyệt trước PATCH; fingerprint ràng buộc công ty, chi nhánh, người thao tác xác thực, phiếu, dòng, số đếm, expectedVersion và ghi chú nếu có. Ghi số đếm và bằng chứng committedVersion trong cùng transaction snapshot/majority; lỗi ghi bằng chứng rollback số đếm, không fallback ghi ngoài transaction.
- Gửi lại đúng mã/nội dung trả phiếu hiện tại sau kiểm tra bằng chứng, không ghi lại số đếm cũ dù phiếu đã sửa tiếp hoặc chuyển trạng thái. Cùng mã khác nội dung/người/chi nhánh bị từ chối. Tranh chấp unique được đọc lại trong transaction có giới hạn; không ghi hai lần. Bằng chứng thiếu chứng từ, sai phiên bản hoặc mất dòng cần đối chiếu riêng.
- Thêm POST /inventory/counts/:id/items/:itemId/reconcile, quyền inventory:manage; lấy công ty/chi nhánh/người thao tác từ phiên xác thực. Endpoint chỉ đọc snapshot, trả completed, revoked hoặc not_found kèm định danh; số lượng hiện tại trùng nhau không đủ để kết luận hoàn tất. Yêu cầu cũ không có requestId vẫn được backend bảo vệ bằng expectedVersion nhưng không tạo bằng chứng lịch sử.
- Đồng bộ trình duyệt xác minh trước: completed chỉ dọn đúng bản còn khớp, not_found mới gửi lại nguyên mã/số đếm/phiên bản. Bản chờ cũ thiếu mã hoặc mã sai không được tự gán mã/phát lại. Kết quả sai định danh/phiên bản, lỗi mạng, đổi phiên hoặc bản thay thế đều được giữ. Kiểm tra lại bản chờ trước PATCH ngăn gửi snapshot đã bị thay thế trong lúc xác minh.
- Panel có nút Xác minh lần lưu; bằng chứng khớp dọn đúng bản và tải lại danh sách phiếu. not_found giữ bản chờ và giải thích chưa thu hồi yêu cầu đang gửi. Modal ràng buộc cả phiên đăng nhập lúc mở, chặn việc dùng token của tài khoản vừa đăng nhập ở tab khác trước khi UI cũ kịp cập nhật; đổi phiên cần mở lại màn hình.
- Thu hồi an toàn: POST /revoke-request dùng cùng unique companyCode/requestId với writer. Chỉ ghi tombstone nếu phiếu còn đúng expectedVersion và trạng thái có thể sửa. Writer đến muộn bị từ chối; nếu bằng chứng completed thắng, hệ thống trả kết quả và giữ nguyên số đếm. Cuộc đua được kiểm tra bằng giao dịch MongoDB thật. Phiếu đã tiến phiên bản nhưng thiếu bằng chứng không được thu hồi hoặc xóa.
- Nút thu hồi yêu cầu yêu cầu xác nhận. reload và discardPending xử lý từng bản qua endpoint này; chỉ dọn sau phản hồi revoked hoặc completed có bằng chứng hợp lệ. Nếu một bản còn chờ, bị thay thế hoặc là bản legacy không mã, thao tác giữ bản đó; reload tải snapshot mới sau khi xác minh. Phản hồi PATCH thiếu ID/phiên bản hợp lệ cũng không dọn hàng chờ.
- Nghiệm thu: 1.070 kiểm thử đạt (38 Node + 1.032 Vitest, 57 file), gồm 23 ca mới. Typecheck và build frontend/backend đạt. Cảnh báo bundle >500 kB còn nguyên. Không triển khai production/migration.
- Phát hành cần xác minh unique companyCode/requestId, hỗ trợ transaction và triển khai backend/client đồng bộ. Không tạo index/migration production hoặc triển khai trong đợt này. Bản thiếu mã và bằng chứng mâu thuẫn vẫn cần phục hồi thủ công.


Khi tiếp tục sau đợt 2026-09-30: ưu tiên quy trình phục hồi thủ công cho bản kiểm kê legacy hoặc mâu thuẫn, có lý do rõ ràng và lưu được bản xuất; không sửa history hoặc tạo UUID giả. Xác minh index companyCode/requestId và triển khai backend/client đồng bộ trước production. Finance/tiền thực, lịch sử thiếu bằng chứng và đồng bộ xuyên thiết bị vẫn mở.

## Tiến độ đã nghiệm thu

Chỉ đánh dấu `[x]` cho phạm vi đã có mã và kiểm chứng; không coi toàn bộ đợt là hoàn tất khi còn hạng mục mở.

- [x] Chống gửi lặp phiếu trả hàng/thu mua: fingerprint theo công ty, chi nhánh, đơn, loại nghiệp vụ, người thao tác, ca bán, dòng hàng/mã máy, giá thu mua, lý do và phương thức/tham chiếu chi tiền. Khóa trùng khác nội dung báo 409, không trả chứng từ ngoài phạm vi. Yêu cầu đồng thời cùng nội dung trả cùng kết quả, không tạo thêm phiếu nhập/tiền hoàn; rollback không giữ khóa.
- [x] Khóa xác nhận đơn bán lưu chi nhánh, đơn và fingerprint thanh toán chuẩn hóa, tổng tiền kỳ vọng, người thao tác, ca bán và loại nghiệp vụ trong cùng transaction. Gửi lại đối chiếu toàn bộ dữ liệu, quyền hiện tại với đơn của thu ngân khác và liên kết đơn–hóa đơn đúng phạm vi; yêu cầu đồng thời cùng nội dung trả một kết quả. Chỉ duplicate-key đúng index công ty/khóa được xem xét replay.
- [x] Tra cứu khóa xác nhận không lộ trạng thái ngoài chi nhánh/công ty; chỉ báo completed khi đủ đơn và hóa đơn liên kết đúng phạm vi. Controller xác nhận/tra cứu trả mã lỗi và HTTP 409 cho xung đột thay vì đổi thành 400.
- [x] Thu công nợ bắt buộc `idempotencyKey` và `expectedVersion`; fingerprint gồm phạm vi/đơn/nghiệp vụ/tác nhân/ca/phiên bản/thanh toán chuẩn hóa. Khóa, tiền thu, phiên bản đơn và sự kiện Finance ghi cùng transaction; cùng khóa/cùng nội dung replay, khác nội dung báo 409. Hai khóa khác nhau dùng cùng phiên bản đơn chỉ một được ghi, tránh thu trùng từ số dư cũ. Không chấp nhận khoản thu rỗng/0 hoặc vượt công nợ.
- [x] Giao diện thu nợ lưu nguyên khoản thu/khóa/phiên bản trong sessionStorage trước khi gửi, chặn gửi liên tiếp; mở lại/tải lại cùng phiên tab dùng đúng yêu cầu cũ. Không tự lấy phiên bản mới hoặc tạo khóa mới sau lỗi mạng. Phản hồi muộn sau đổi phạm vi/đóng form không cập nhật màn hình khác; lỗi lưu trình duyệt chặn gửi. Chỉ validation `COLLECTION_INVALID`/400 ở lần đầu cho phép sửa lại.
- [x] Hủy đơn bắt buộc khóa thao tác/phiên bản; fingerprint kiểm tra phạm vi, đơn, tác nhân, ca bán, lý do và khoản hoàn chuẩn hóa. Khóa commit cùng hoàn kho/máy, hoàn tiền, trạng thái đơn/hóa đơn và sự kiện. Cùng khóa/cùng nội dung trả kết quả cũ; khác nội dung báo xung đột, khác khóa trên phiên bản cũ không được hủy. Replay đơn từng hoàn tất vẫn kiểm tra quyền quản lý hiện tại.
- [x] Hủy nháp xóa đơn và lưu snapshot kết quả hủy trong cùng transaction để replay được sau khi đơn đã xóa; giữ kiểm tra chủ đơn/quyền quản lý. Bỏ đường hủy nháp ngoài transaction. POS tự dọn nháp sau lỗi xác nhận gửi khóa ổn định và phiên bản đã lưu, không tự lấy phiên bản mới.
- [x] Form hủy giữ nguyên lý do/phương thức/số tiền hoàn/khóa/phiên bản trong sessionStorage trước khi gửi; chặn gửi liên tiếp, sửa nội dung khi chưa rõ kết quả và cập nhật màn hình khác từ phản hồi muộn. Mở lại/tải lại cùng phiên tab dùng yêu cầu cũ. Chỉ validation `CANCELLATION_INVALID`/400 ở lần đầu cho phép sửa lại.
- [x] Xác nhận đơn bắt buộc `expectedVersion` nguyên không âm, nằm trong fingerprint và điều kiện đọc nháp của transaction. Nháp bị sửa dù tổng tiền không đổi vẫn báo 409; transaction retry không tự chốt phiên bản mới. Replay phải dùng phiên bản của yêu cầu gốc, không dùng phiên bản đơn sau khi chốt.
- [x] POS gửi phiên bản trả về từ lần lưu nháp; hàng đợi offline lưu `draftId`, `draftVersion`, `draftSaved` cùng khóa/thanh toán. Xác nhận chỉ gửi khi đã nhận được bằng chứng lưu nháp thành công. Mục cũ thiếu metadata và xung đột giữ để đối chiếu, không tải phiên bản mới để xác nhận; yêu cầu sửa nháp có khóa gốc được phục hồi như mô tả bên dưới.
- [x] Tạo nháp bắt buộc khóa; fingerprint phạm vi/tác nhân/nội dung đầu vào, khóa và đơn commit cùng transaction. Gửi đồng thời cùng khóa trả một nháp/một suất treo; tranh suất với khóa khác retry có giới hạn chỉ khi trùng đúng index suất treo. Giữ giới hạn 5 đơn. Không nuốt lỗi unique khác; lỗi lưu khóa rollback nháp. Replay chỉ trả nháp gốc version 0 còn tồn tại, không thay nháp đã sửa/xóa/hủy/xác nhận.
- [x] POS/treo đơn lưu khóa và nội dung tạo trong sessionStorage theo công ty/chi nhánh/tài khoản, chặn thao tác tạo đồng thời. Yêu cầu chưa rõ kết quả với nội dung khác bị giữ để đối chiếu. Offline có khóa tạo gốc được gửi lại đúng yêu cầu đó; phải lưu ID/phiên bản phục hồi vào hàng đợi thành công trước khi xác nhận. Không tự dựng khóa cho mục cũ. Tạo nháp trong transaction vẫn chặn cộng dồn coupon/giảm thủ công.
- [x] Sửa nháp bắt buộc khóa và phiên bản nguyên không âm; fingerprint gồm phạm vi/tác nhân/đơn/phiên bản/nội dung. Khóa và thay đổi nháp commit cùng transaction. Gửi đồng thời cùng khóa chỉ tăng phiên bản một lần; hai khóa trên cùng phiên bản chỉ một thành công. Replay kiểm tra quyền hiện tại và chỉ trả đúng phiên bản kết quả; nháp bị sửa tiếp hoặc đã xác nhận báo xung đột.
- [x] POS giữ yêu cầu sửa theo công ty/chi nhánh/tài khoản/đơn trước khi gửi. Offline phục hồi bằng đúng khóa/nội dung/phiên bản gốc và lưu kết quả vào hàng đợi trước khi xác nhận, không tự lấy phiên bản mới. Tạo/sửa bị từ chối bằng lỗi nghiệp vụ 400 rõ ràng cho phép sửa nội dung nhưng giữ nguyên khóa; lỗi mạng, phản hồi không rõ và 409 vẫn giữ yêu cầu. Phản hồi cũ không xóa hoặc mở khóa nội dung mới đã sửa.
- [x] Bộ đọc lỗi API giữ mã nghiệp vụ cấp cao nhất của phản hồi bán lẻ để giao diện nhận đúng lỗi validation/xung đột. Nghiệm thu đợt sửa nháp: 456 test kho đạt (38 Node + 418 Vitest, 39 file Vitest); typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB.
- [x] Trả/thu mua máy đối chiếu công ty/chi nhánh/kho nguồn, sản phẩm/biến thể/SKU, liên kết đơn bán và sự kiện gần nhất với sổ xuất gốc trong transaction. Máy thiếu lịch sử hoặc đã qua nghiệp vụ khác báo `AFTER_SALE_SERIAL_CONFLICT`/409; nguồn xuất không khớp báo `RETAIL_STOCK_SOURCE_CONFLICT`/409. Mã vạch phụ được chọn phải thuộc đúng máy serial đang trả. Cập nhật máy có điều kiện và ghi sự kiện thất bại rollback phiếu nhập, tồn kho, chứng từ trả và tiền hoàn.
- [x] Nghiệm thu đối chiếu máy trả/thu mua: 472 test kho đạt (38 Node + 434 Vitest, 39 file Vitest), thêm 16 ca tích hợp; 10 test trả hàng/hoàn điểm liên quan đạt. Trả từng máy giữ máy còn lại ở trạng thái đã bán; thu mua vẫn nhập kho mặc định hiện tại theo giá thỏa thuận, trả hàng về kho nguồn theo giá vốn gốc. Typecheck/build đạt, còn cảnh báo bundle lớn hơn 500 kB. Dữ liệu lịch sử thiếu bằng chứng cần đối soát, không tự dựng sự kiện; chưa triển khai production.
- [x] Ngừng đổi trạng thái máy qua API trực tiếp `/:id/transition`: máy trong phạm vi trả `SERIAL_WORKFLOW_REQUIRED`/409, máy ngoài công ty/chi nhánh/kho trả 404. Không chấp nhận mã chứng từ do client gửi như bằng chứng đã ghi sổ; phải dùng nghiệp vụ bán hàng, phiếu kho, kiểm kê, điều chuyển hoặc sửa chữa tương ứng. Endpoint giữ lại để client cũ nhận lỗi rõ ràng; giao diện hiện không gọi đường này.
- [x] Nghiệm thu chặn đổi trạng thái trực tiếp: 490 test kho đạt (38 Node + 452 Vitest, 39 file Vitest), thêm 18 ca tích hợp bao phủ 17 chuyển trạng thái và phạm vi công ty/chi nhánh/kho. Các yêu cầu bị từ chối không sửa máy, tồn, sổ kho hoặc lịch sử. Typecheck/build đạt, còn cảnh báo bundle lớn hơn 500 kB; chưa triển khai production.
- [ ] Khôi phục yêu cầu chờ giữa nhiều tab/thiết bị và giao diện đối chiếu/xử lý yêu cầu xung đột.
- [ ] Đưa nhận/trả máy sửa chữa vào cùng transaction với phiếu và lịch sử máy; kiểm tra phạm vi chi nhánh, liên kết đúng phiếu khi giao máy và gửi lại an toàn. `recordRepairSerialLifecycle` hiện cập nhật máy/sự kiện riêng sau khi lưu phiếu; chưa nghiệm thu luồng này.
- [x] Nghiệm thu tạo nháp có khóa: 434 test kho đạt (34 Node + 400 Vitest, 39 file Vitest), bổ sung 12 ca tích hợp và 5 ca bộ nhớ/offline. Bộ POS liên quan đạt; typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc backfill khóa cũ.
- [x] Nghiệm thu phiên bản xác nhận: 417 test kho đạt (34 Node + 383 Vitest, 38 file Vitest), thêm 8 ca tích hợp và 9 ca offline. Bộ POS/đồng bộ liên quan đạt; typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc sửa metadata lịch sử.

Triển khai tạo/sửa/xác nhận nháp cần frontend/backend đồng bộ và MongoDB hỗ trợ transaction. Tạo nháp thiếu khóa nhận `DRAFT_KEY_REQUIRED`/400; sửa nháp thiếu khóa hoặc phiên bản hợp lệ nhận `DRAFT_UPDATE_INVALID`/400; xác nhận thiếu phiên bản nhận `ORDER_VERSION_REQUIRED`/400; nháp khác phiên bản nhận `ORDER_VERSION_CONFLICT`/409. Khóa lịch sử không được suy ngược metadata hoặc tự thay bằng khóa mới. Tạo/sửa nháp offline có khóa và metadata gốc nay phục hồi được; mục cũ thiếu metadata hoặc xung đột vẫn dừng chờ đối chiếu. Chưa có màn hình hòa giải; sửa nội dung sau lỗi nghiệp vụ 400 rõ ràng vẫn dùng cùng khóa, nên yêu cầu cũ đã commit sẽ bị chặn nếu nội dung thay đổi. Chưa triển khai production.
- [x] Nghiệm thu chống hủy lặp: 400 test kho đạt (34 Node + 366 Vitest, 37 file Vitest), gồm 14 ca tích hợp mới và 3 ca giao diện; ca hủy đồng thời cũ nay xác nhận cả hai yêu cầu cùng khóa nhận kết quả thành công với một lần ghi. Thêm 16 test POS/trang đơn bán đạt; typecheck và build frontend/backend đạt. Chưa triển khai production hoặc sửa dữ liệu lịch sử.

Hủy đơn cần triển khai frontend/backend cùng nhau; client cũ thiếu khóa/phiên bản bị từ chối. Hủy nháp cũng cần MongoDB hỗ trợ transaction; không fallback sang xóa riêng lẻ. Snapshot nháp trong khóa là kết quả hủy phục vụ đối chiếu, không dựng lại đơn hoặc nguồn tồn. Đơn đã hủy trước đợt này không được tự tạo khóa lịch sử để coi là replay. Ghi chú của đợt serial hủy bán bên dưới phản ánh thời điểm chưa có replay; hiện hai yêu cầu cùng khóa hợp lệ đều nhận thành công nhưng chỉ một lần ghi kho/tiền hoàn.
- [x] Nghiệm thu thu công nợ: 383 test kho đạt (34 Node + 349 Vitest, 36 file Vitest), gồm 14 ca tích hợp mới và 3 ca giao diện. Bộ giao diện đơn bán liên quan và 41 test Node bán lẻ đạt; typecheck/build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc thay số dư lịch sử.

Hợp đồng thu nợ đã đổi: cần triển khai frontend/backend cùng nhau; client cũ thiếu khóa/phiên bản bị từ chối trước khi ghi. Mỗi lần thu tiếp hợp lệ sau thành công dùng phiên bản đơn mới và khóa mới. Replay trả trạng thái đơn hiện tại trong đúng phạm vi, không tạo thêm thanh toán/sự kiện. Endpoint tra cứu khóa hiện vẫn dành cho xác nhận đơn; thu nợ dùng lại POST với yêu cầu lưu. Các khoản thu lịch sử không được tự dựng khóa hoặc sửa số dư. Chưa triển khai production.
- [x] Nghiệm thu khóa xác nhận: 366 test kho đạt (34 Node + 332 Vitest), gồm 18 ca tích hợp mới về phạm vi, payload, đồng thời, chứng từ hỏng/thiếu, dữ liệu cũ và quyền replay. Thêm 41 test Node về thanh toán/giá/schema bán lẻ đạt; typecheck và build frontend/backend đạt. Chưa triển khai production hoặc backfill khóa lịch sử.

Khóa xác nhận cũ thiếu chi nhánh/fingerprint không được suy đoán hay backfill: thao tác xác nhận trả `ORDER_IDEMPOTENCY_CONFLICT`. Tra cứu khóa thiếu chi nhánh trả not_found, nhưng gửi lại cùng khóa vẫn bị chặn; hàng đợi cũ cần đối chiếu đơn gốc, không tự đổi khóa để vượt lỗi. Khóa processing đúng nội dung báo đang xử lý, không tự chiếm lại. Fingerprint dùng thứ tự thanh toán và giá trị được chuẩn hóa theo nghiệp vụ; không đưa ngày hiện tại vào nên retry qua ngày không tự xung đột. API tra cứu theo khóa chỉ kiểm tra bằng chứng/phạm vi, không thay thế so khớp payload tại API xác nhận. Giá trị hàng hóa lấy từ đúng phiên bản đơn lưu trên server mà client yêu cầu xác nhận.
- [x] Giao diện `AfterSalesForm` giữ nguyên khóa và toàn bộ nội dung khi chưa rõ kết quả, chặn gửi liên tiếp bằng khóa đồng bộ; lưu trước khi gửi vào sessionStorage theo công ty/chi nhánh/tài khoản/đơn. Mở lại form hoặc tải lại trang trong phiên tab vẫn gửi đúng yêu cầu cũ. Đổi phạm vi hoặc đổi nghiệp vụ khi còn yêu cầu chờ bị chặn; phản hồi thành công đến muộn sau đổi phạm vi/đóng form không đóng hay làm mới màn hình khác.
- [ ] Phục hồi yêu cầu chưa rõ kết quả giữa nhiều tab/thiết bị hoặc sau khi đóng phiên trình duyệt; quy trình đối chiếu/xử lý thủ công yêu cầu xung đột. Đợt này không coi sessionStorage là hàng đợi bền vững toàn hệ thống.
- [x] Nghiệm thu form gửi lại: 348 test kho đạt (34 Node + 314 Vitest, 35 file Vitest), thêm 8 ca hook và 2 ca giao diện trả/thu mua vào runner kho/CI. Bộ giao diện đơn bán liên quan đạt; typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production.
- [x] Nghiệm thu backend chống gửi lặp trả/thu mua: 338 test kho đạt (34 Node + 304 Vitest), gồm 19 ca tích hợp mới về phạm vi/nội dung, giá thu mua, mã máy, đồng thời, rollback, dữ liệu cũ và lỗi unique không liên quan. Bộ trả hàng/phân hạng liên quan cũng đạt; typecheck và build frontend/backend đạt, còn cảnh báo bundle lớn hơn 500 kB.

Phiếu trả/thu mua lưu `requestFingerprint` cùng transaction với nghiệp vụ, dùng unique index công ty + khóa hiện có. Chỉ lỗi duplicate-key đúng index này được xem xét replay; lỗi unique khác vẫn trả nguyên trạng. Kiểm tra lại khóa trong transaction để xử lý retry do cạnh tranh. Chuẩn hóa các trường mặc định và khoảng trắng; thứ tự dòng/mã máy vẫn thuộc nội dung yêu cầu. Ngày hiện tại không vào fingerprint để không làm hỏng retry qua ngày; ID ca bán vẫn phải khớp. Phiếu cũ thiếu fingerprint bị từ chối replay bằng lỗi `AFTER_SALE_IDEMPOTENCY_CONFLICT`, cần đọc/đối chiếu chứng từ gốc; không tự backfill hoặc tự tạo khóa mới. Chưa triển khai production.

Form khóa nội dung sau khi gửi, hiển thị nút thử lại yêu cầu cũ. Chỉ lỗi validation `AFTER_SALE_INVALID`/400 ngay lần gửi đầu cho phép bỏ yêu cầu và sửa dữ liệu; lỗi mạng, lỗi khác hoặc lỗi sau một lần chưa rõ kết quả đều giữ nguyên. Thành công mới xóa yêu cầu lưu; lỗi xóa vẫn giữ khóa cũ để replay an toàn. Không đọc/lưu được bộ nhớ thì chặn gửi, không âm thầm tạo khóa thay thế. Việc đóng form không hủy thao tác đã gửi đến server.

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
- [x] Xuất/hoàn linh kiện sửa chữa và hủy phiếu cùng transaction với ledger, tồn kho và tổng tiền; chống gửi lặp/xung đột và hoàn theo kho/giá vốn xuất gốc.
- [x] Kiểm thử sửa chữa: 287 test kho đạt (34 Node + 253 Vitest), gồm 18 ca replica set mới; 20 test sửa chữa/giao diện liên quan đạt, có ca giữ khóa khi gửi lại. Typecheck đạt. Ca giao diện duyệt kiểm kê được đổi sang thao tác người dùng có chờ cập nhật, giữ nguyên các kiểm tra bắt buộc xác nhận/lý do; lần chạy lại toàn bộ đã đạt.
- [x] Build frontend/backend sau đợt sửa chữa đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc thay đổi dữ liệu lịch sử.
- [x] Giá vốn đơn bán xác nhận lấy từ ledger xuất, lưu liên kết từng dòng/kho; hủy/trả về kho và giá vốn gốc, kiểm tra dữ liệu lịch sử trước khi hoàn. Thu mua lại giữ giá mua thỏa thuận riêng.
- [x] Báo cáo tài chính xác minh liên kết giá vốn mới, nhận giá vốn 0 có chứng cứ và đọc được nguồn xuất khi phiếu trả khác kỳ bán. Không dùng giá nhập khác thay thế khi liên kết mới bị hỏng.
- [x] Hủy đơn bán đối chiếu đầy đủ tập IMEI/mã nội bộ với đơn, ledger, kho và sự kiện bán gốc; thiếu/thừa/sai trạng thái hoặc lỗi hoàn máy/sự kiện đều rollback toàn bộ chứng từ, tiền hoàn và tồn kho.
- [x] Build frontend/backend sau đợt serial hủy bán đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production hoặc sửa dữ liệu cũ.
- [x] Nghiệm thu serial hủy bán: 319 test kho đạt (34 Node + 285 Vitest), typecheck đạt; bổ sung 18 ca tích hợp cho serial/mã nội bộ, sai phạm vi/định danh/nguồn, thiếu/thừa/trùng mã, lịch sử phát sinh sau bán, lỗi cập nhật/sự kiện và hai lệnh hủy đồng thời.
- [x] Build frontend/backend sau đợt giá vốn bán lẻ đạt; còn cảnh báo bundle lớn hơn 500 kB. Chưa triển khai production, cấp quyền hoặc sửa dữ liệu lịch sử.
- [x] Nghiệm thu giá vốn bán lẻ: 301 test kho đạt (34 Node + 267 Vitest), gồm 14 ca tích hợp mới; 48 test Node đơn bán/tính tiền/hóa đơn/báo cáo đạt. Nhóm Vitest chọn lọc đổi trả/phân hạng/giá vốn/tài chính đạt 65 test (có trùng các ca trong bộ kho); thêm 3 ca xác minh giá vốn tài chính. Typecheck đạt.
- [ ] Xử lý dữ liệu cũ đã đối soát; hoàn thiện các writer retail/repair còn lại, vòng đời máy sửa chữa, toàn bộ báo cáo và chính sách định giá tồn âm/làm tròn.
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
- [x] Quyền duyệt kiểm kê độc lập/cấm tự duyệt: catalog, middleware API, ID tác nhân và khóa nút trên giao diện; không tự cấp quyền vào role/user hiện có.
- [x] Nghiệm thu quyền duyệt: 251 test kho đạt (34 Node + 217 Vitest), typecheck và build frontend/backend đạt. Thêm 3 ca tích hợp ID/tự duyệt/phiếu cũ, 5 ca quyền API/catalog và 1 ca UI; kiểm thử catalog riêng cũng đạt. Build còn cảnh báo bundle lớn.
- [x] Tạo lại phiếu kiểm kê conflict: snapshot mới, liên kết hai chiều, chống tạo trùng và giao diện xác nhận kiểm đếm lại.
- [x] Nghiệm thu tạo lại: 261 test kho đạt (34 Node + 227 Vitest), typecheck và build frontend/backend đạt. Bổ sung 4 ca tích hợp, 3 ca quyền API và 3 ca UI; build còn bundle lớn hơn 500 kB.
- [x] Xác nhận chênh lệch và đối chiếu từng mã ngoài dự kiến trước duyệt; kiểm tra phiên bản, lưu kết quả duyệt và hoàn tác khi máy thiếu đã đổi trạng thái/vị trí.
- [x] Nghiệm thu xác nhận chênh lệch: 269 test kho đạt (34 Node + 235 Vitest), typecheck và build frontend/backend đạt. Bổ sung 6 ca backend, 1 ca UI và 1 ca service; build còn cảnh báo bundle lớn.
- [ ] Cấp quyền theo danh sách vai trò/người duyệt được xác nhận trước phát hành; rà cách cấp mã các loại phiếu còn lại.
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

Phạm vi sửa chữa đã triển khai: xuất/hoàn linh kiện, tính lại tiền và hủy phiếu dùng chung transaction; cả API đổi trạng thái sang `cancelled` cũng ủy quyền vào luồng này. Một cập nhật `partsVersion` trên phiếu tuần tự hóa thao tác linh kiện đồng thời, kể cả linh kiện miễn phí. Hủy phiếu hoàn mọi linh kiện hoặc rollback toàn bộ, không bỏ qua lỗi hoàn kho. Báo giá khách đã duyệt vẫn được giữ theo chính sách hiện có.

Giá vốn linh kiện kho lấy từ ledger lúc xuất, lưu kho/variant/ledger gốc trên RepairPart; hoàn về đúng kho và giá vốn gốc dù kho mặc định/bình quân đã đổi. Khóa xuất kiểm tra fingerprint và phạm vi phiếu/chi nhánh; giao diện giữ khóa khi retry trong cùng form. Hoàn/hủy lặp cùng lý do không cộng tồn hai lần. Trường tác nhân hoàn được lưu vào schema.

Giới hạn đợt sửa chữa: chỉ linh kiện catalog `quantity` và linh kiện nhập tay không trừ kho; từ chối serial/unit barcode/lô và tracking mode khác đến khi có quy trình định danh riêng. Sản phẩm từ màn hình tìm kiếm legacy phải có mapping rõ ràng đúng chi nhánh sang catalog/variant; không suy diễn mapping chỉ bằng SKU hoặc tự chuyển dữ liệu. Phiếu cũ thiếu/mâu thuẫn ledger, có bút toán mồ côi hoặc đã hủy nhưng còn linh kiện issued phải được đối soát trước. Chưa sửa dữ liệu lịch sử, chưa đồng bộ lại tồn hiển thị trên nguồn Product legacy, chưa thiết kế hoàn tiền/công nợ khi hủy phiếu đã thu tiền. Các luồng báo giá/thanh toán/giao máy và vòng đời serial sửa chữa còn cần rà soát cạnh tranh riêng; chưa coi toàn bộ repair/retail là hoàn tất. Khóa frontend chưa được giữ qua đóng form/tải lại trang.

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

Đã nghiệm thu phần bán lẻ: khi xác nhận đơn, `unitCost` và `totalCost` được chốt từ các bút toán xuất trước khi lưu đơn/lập hóa đơn/tính điểm hoặc hoa hồng. Giá bán và tổng tiền khách trả không đổi theo thay đổi giá vốn. Mỗi dòng giữ `stockLedgerId`/`stockWarehouseId`; giá vốn bình quân lẻ và giá vốn 0 được giữ nguyên. Các truy vấn catalog/giá/tồn khi chốt đơn dùng session của transaction.

Hủy/trả hàng đối chiếu đầy đủ sổ xuất theo công ty, chi nhánh, nguồn, chỉ số dòng, SKU, định danh, số lượng, giá vốn và liên kết đã lưu. Hoàn về kho gốc kể cả khi kho mặc định đã đổi; phục hồi serial dùng cùng kho với phiếu nhập. Trả từng phần tính lại giá vốn còn lại theo số lượng đã trả, không trừ rồi ép về 0 để che sai lệch. Thu mua lại là lần mua mới, giữ giá mua thỏa thuận và không đảo giá vốn lần bán trước. Phiếu trả mới cũng lưu liên kết bút toán xuất để Finance xác minh, kể cả phiếu trả và đơn bán nằm ở hai kỳ khác nhau.

Giới hạn: thiếu/mâu thuẫn ledger, giá vốn đơn hoặc phiếu trả cũ sai, kho xuất không còn hoạt động đều yêu cầu đối soát; không tự sửa lịch sử hoặc chuyển hàng sang kho khác. Các snapshot Finance cũ chưa có liên kết vẫn dùng chính sách bằng chứng cũ; chưa coi toàn bộ báo cáo/historical cost là đã thống nhất. Chính sách tồn âm, làm tròn toàn hệ thống, fingerprint/phạm vi replay các API retail và báo cáo sản phẩm sau trả hàng vẫn còn mở. Các test tích hợp mới dùng kho/đơn/hóa đơn MongoDB thật và mock các điểm tích hợp thông báo/phân hạng/hoa hồng; bộ phân hạng riêng chạy nghiệp vụ thật, chờ job completed thay cho sleep 200 ms.

Đợt tiếp theo đã bổ sung kiểm tra tập máy khi hủy bán: đọc đơn đã lưu và mọi máy còn liên kết với lần bán, kể cả máy đã đổi chi nhánh/trạng thái. Danh sách mã phải đủ số lượng, không trùng máy giữa các dòng, đúng product/variant/SKU và kho xuất. Máy phải còn sold, đúng soldOrderId/soldBranchId/currentDocument và sự kiện cuối phải là lần bán gốc. Đối chiếu cả mã nội bộ đã chốt của dòng serial nếu có; không âm thầm bỏ qua máy cập nhật không thành công. Thiếu hoặc thừa một máy, thiếu lịch sử bán hoặc có nghiệp vụ sau bán đều trả xung đột và rollback. Phiếu hủy nhập kho phải tồn tại trong cùng transaction, thuộc đúng đơn và kho nguồn. Hai lệnh hủy đồng thời chỉ một lệnh thành công; chưa thêm cơ chế trả lại kết quả thành công cho yêu cầu hủy đã commit. Vòng đời máy chung và điều kiện trả hàng sau bán vẫn cần rà riêng, không tự sửa dữ liệu cũ.

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

- [x] Tách quyền duyệt kiểm kê bằng `inventory-count-approval:manage`, theo cặp read/manage của catalog hiện tại. Route approve dùng middleware quyền riêng; giao diện khóa nút khi thiếu quyền. `inventory:manage` không suy ra quyền này.
- [x] Người lập hoặc người gửi duyệt không được tự duyệt; kiểm tra bằng ID xác thực, không so tên/email. Lưu createdById/submittedById/approvedById cùng các tên và mốc thời gian hiện có. Không có ngoại lệ tự duyệt cho quản trị hoặc wildcard.
- [x] Xác thực kho trong cùng transaction tạo kiểm kê; đọc balance/catalog/variant/serial theo readConcern snapshot, lưu phiếu trong transaction. Lưu `snapshotStartedAt` là giờ máy chủ bắt đầu lượt transaction thành công, không phải timestamp chính xác của MongoDB snapshot. Phiếu cũ không được gán mốc giả.
- [x] Khi duyệt, đối chiếu toàn bộ tập balance của kho cùng version từng dòng; phát hiện thêm/mất SKU ngoài danh sách phiếu, kể cả phiếu chốt lúc kho trống. Kho không đổi và phiếu trống vẫn duyệt được, không sinh ledger.
- [x] Kiểm thử cập nhật/quét đồng thời; dùng version và optimistic concurrency để tránh mất lượt quét hoặc lưu bản đã đọc trước khi gửi duyệt.

Phạm vi đã nghiệm thu cục bộ: schema InventoryCount dùng optimistic concurrency trên trường `version` hiện có. Cập nhật dòng, quét mã, gửi/hủy/bắt đầu và hoàn thành phiếu đều lưu có kiểm tra phiên bản; bản cũ trả 409 với yêu cầu tải lại. Quét mã tự đọc lại và thử tối đa 5 lần chỉ khi có lỗi version, kiểm tra lại trạng thái phiếu mỗi lần; lỗi lưu khác không tự thử lại. Quét hai mã cùng máy không tăng số đếm hai lần, các mã ngoài dự kiến đồng thời không ghi đè nhau. Chỉ đánh dấu `conflict` sau lỗi tồn kho thay đổi, với điều kiện phiếu vẫn chờ duyệt và cùng version; lỗi 409 khác không được đổi trạng thái phiếu.

Đợt tiếp theo bổ sung `expectedVersion` bắt buộc cho API sửa số lượng/ghi chú. Thiếu/sai định dạng trả 400; phiên bản cũ trả 409 trước khi ghi. Giao diện gửi version đã tải, không tự đổi sang version mới khi gặp conflict. Hàng đợi ngoại tuyến giữ version gốc; bản cũ thiếu version hoặc bị conflict được giữ lại để người dùng đối chiếu, không tự áp lên snapshot mới. Các lần đồng bộ trong cùng tab dùng chung một lượt chạy; không xóa bản chờ mới hơn được thêm trong khi đang gửi bản cũ. Nút “Tải lại phiếu” yêu cầu xác nhận, chờ lượt đồng bộ đang chạy và tải thành công trước khi bỏ bản chờ của đúng phiếu. Mã API cũ không gửi expectedVersion phải cập nhật cùng frontend.

Snapshot tạo phiếu hiện đã dùng transaction với `readConcern: snapshot` và commit majority; các truy vấn cùng session chạy tuần tự. Từ chối kho khác phạm vi, kho ngừng hoạt động hoặc transit trong snapshot. Hạ tầng không hỗ trợ transaction trả lỗi, không fallback sang đọc rời. Sáu ca mới gồm xuất hàng chen giữa hai lần đọc, thêm SKU sau khi chốt, kho trống, phạm vi/transit, tắt transaction và lỗi lưu phiếu. Việc chốt không thay đổi tồn hoặc version balance, không khóa kho suốt thời gian kiểm đếm.

Giới hạn: chưa yêu cầu version từ client cho các thao tác bắt đầu/gửi/hủy (vẫn có optimistic concurrency phía server); duyệt đã yêu cầu phiên bản và kết quả đối chiếu tường minh. Hàng đợi localStorage chưa được thiết kế lại để đồng bộ giữa nhiều tab hoặc phân vùng theo tài khoản; phạm vi truy cập vẫn do backend kiểm tra.
- [x] Nghiệm thu thao tác tạo lại phiếu conflict và mở phiếu liên quan.
- [x] Xác nhận chênh lệch trước điều chỉnh: API duyệt yêu cầu expectedVersion, xác nhận boolean và lý do khi có dòng lệch hoặc máy thiếu. Giao diện liệt kê dòng lệch/máy sẽ ghi thất lạc, khóa duyệt đến khi xác nhận đủ.
- [x] Đối chiếu từng mã ngoài dự kiến: phải gửi đúng đủ danh sách mã kèm kết quả/lý do riêng; không tự bỏ qua. Lưu approvalReview gồm phiên bản được duyệt, lý do, kết quả từng mã, ID tác nhân và thời điểm trong cùng transaction; giao diện hiển thị lại kết quả đã lưu.
- [ ] Tự động thực thi chứng từ sửa sai cho máy ngoài dự kiến chưa triển khai; người vận hành thực hiện nghiệp vụ phù hợp và ghi kết quả/chứng từ đối chiếu. Xác nhận không tự nhập thêm máy hoặc chuyển máy khác kho vào phiếu.

Kiểm soát dữ liệu trước duyệt: số lượng và delta phải khớp; hàng theo máy phải có danh sách expected/scanned duy nhất, scanned là tập con expected và số lượng khớp danh sách. Máy thiếu chỉ đổi sang lost nếu vẫn đúng company/branch/kho/product/variant và in_stock; không cập nhật được thì rollback toàn bộ. Máy lost mang tham chiếu phiếu kiểm kê và ID tác nhân. API cũ duyệt không gửi body/version/xác nhận sẽ bị từ chối, cần triển khai frontend/backend cùng nhau. Xác nhận chênh lệch và kết quả đối chiếu không tự chứng minh sự thật vật lý; người duyệt chịu trách nhiệm đối chiếu trước khi gửi.

Luồng tạo lại: `POST /inventory/counts/:id/recreate` yêu cầu `inventory:manage`, chỉ nhận phiếu conflict trong công ty/chi nhánh hiện tại. Phiếu mới cùng kho, trạng thái nháp, có snapshot mới và ID người lập; toàn bộ số đếm về 0, mã đã quét/mã ngoài dự kiến không được chuyển sang. Phiếu gốc giữ nguyên trạng thái và nội dung đếm, chỉ thêm replacementCountId; phiếu mới có recreatedFromId. Tạo phiếu và liên kết commit trong cùng transaction snapshot; gửi lặp/đồng thời cùng phiếu gốc trả cùng phiếu thay thế. Liên kết bị mất/hỏng báo lỗi để đối soát, không tự sinh thêm phiếu. Kho ngừng hoạt động/transit bị từ chối.

Giao diện giải thích phải kiểm đếm lại và yêu cầu xác nhận; có nút mở phiếu gốc/phiếu thay thế. Khi duyệt trả 409, giao diện đọc lại trạng thái để hiển thị thao tác tạo lại nếu backend đã đánh conflict; không tự tạo phiếu mới. Đợt này chưa cho tạo lại phiếu pending/completed/cancelled hoặc phiếu cũ thiếu ID nhưng chưa conflict.
- [ ] Áp dụng cấp quyền theo danh sách cụ thể đã được người phụ trách xác nhận trên staging/production; chưa thay dữ liệu RolePermission/User hoặc cấp rộng quyền mới trong đợt mã này.

Chuẩn bị phát hành quyền duyệt: catalog được đồng bộ qua cơ chế seed hiện có, không đổi marker reset quyền. Người duyệt cần `inventory:read` để mở module/đọc phiếu và `inventory-count-approval:manage` để duyệt; quyền `inventory-count-approval:read` một mình không cho phép duyệt. Lập danh sách company/role hoặc user ID cần thêm quyền, giữ nguyên các quyền cũ, thử bằng ít nhất hai tài khoản độc lập trên staging rồi mới áp dụng danh sách đó. Admin có cấu hình role riêng hoặc dùng mặc định đều không tự được thêm quyền này; superadmin vẫn qua cổng quyền wildcard nhưng chịu kiểm tra cấm tự duyệt. Chưa chạy thao tác cấp quyền trên dữ liệu thực.

Phiếu cũ thiếu ID người lập, hoặc có thông tin người gửi nhưng thiếu ID người gửi, bị từ chối duyệt với lỗi 409 và hướng dẫn lập phiếu mới. Không suy ID từ email/tên, không backfill giả. Tạo phiếu/gửi duyệt/duyệt mới yêu cầu định danh tác nhân; trường ID không lấy từ request body. Phiếu lỗi phân quyền/tự duyệt vẫn giữ trạng thái chờ duyệt, không đổi sang conflict và không điều chỉnh tồn.

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
