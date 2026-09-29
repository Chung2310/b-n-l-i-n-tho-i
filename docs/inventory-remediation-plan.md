# Kế hoạch khắc phục module kho hàng

Ngày lập/cập nhật: 2026-09-29. Trạng thái: đang triển khai; lõi ghi sổ, điều chuyển, đảo phiếu xuất, cấp phát/thu hồi nội bộ và công cụ đối soát chỉ đọc đã nghiệm thu chức năng cục bộ, chưa triển khai production hoặc sửa dữ liệu cũ.

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
