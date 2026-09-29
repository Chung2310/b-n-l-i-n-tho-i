# Đối soát kho chỉ đọc

Chạy thủ công theo công ty, có thể giới hạn chi nhánh/kho. Không dùng cấu hình khởi động ứng dụng, không seed, migration, tạo index hay sửa bản ghi MongoDB. Dùng native driver và session snapshot để các lần đọc thấy cùng một thời điểm. Cần replica set/sharded cluster hỗ trợ snapshot reads (MongoDB 5+); nếu không hỗ trợ, công cụ dừng và không hạ xuống đọc thiếu nhất quán.

## Chạy

Đặt `INVENTORY_AUDIT_MONGODB_URI` trong môi trường; ưu tiên tài khoản chỉ có quyền `read` trên database được chọn. Công cụ không tự đọc `.env` hoặc dùng URI production của ứng dụng.

```powershell
npm run audit:inventory -- --help
npm run audit:inventory -- --company COMPANY --db database_name --out .\inventory-audit-run-001
npm run audit:inventory -- --company COMPANY --db database_name --branch 000000000000000000000001 --out .\inventory-audit-run-002 --baseline .\baseline-reviewed.json
```

`--out` phải là thư mục mới, thư mục cha đã tồn tại. Không ghi đè báo cáo cũ. `--warehouse OBJECT_ID` giới hạn kho; nếu chỉ định cả branch thì quan hệ branch–warehouse được kiểm tra. Đối soát điều chuyển có thể đọc các chặng liên quan trong cùng công ty để kiểm tra bảo toàn lượng/giá trị.

- `--batch-size`: số bản ghi mỗi lượt fetch cursor, mặc định 200, từ 1 đến 1.000.
- `--max-documents`: giới hạn bản ghi gốc quét qua các collection, mặc định 100.000. Các truy vấn đối chiếu liên quan không nằm trong bộ đếm này. Vượt giới hạn thì dừng với báo cáo chưa hoàn tất; chia phạm vi hoặc tăng giới hạn rồi chạy mới. Không hỗ trợ nối tiếp từ cursor cũ vì phải giữ cùng snapshot.
- Mỗi truy vấn có giới hạn thời gian 15 giây. Nếu snapshot hết hạn, timeout hoặc mất kết nối: chạy lại vào thư mục mới. Không dùng báo cáo dở làm kết luận.

## Baseline

Mặc định **không giả định ledger đầy đủ hoặc tồn đầu kỳ bằng 0**. Mỗi balance chưa có baseline được gắn `BASELINE_UNVERIFIED`, không kết luận lệch balance–ledger.

File baseline do người phụ trách xác nhận từ nguồn lịch sử đáng tin cậy, không được tạo bằng cách chép balance hiện tại để làm mất chênh lệch. `asOf` là mốc UTC: quantity/value đã bao gồm mọi ledger có `createdAt <= asOf`; đối soát chỉ cộng biến động có `createdAt > asOf`.

```json
{
  "schemaVersion": 1,
  "companyCode": "COMPANY",
  "asOf": "2026-01-01T00:00:00.000Z",
  "balances": [
    {
      "branchId": "000000000000000000000001",
      "warehouseId": "000000000000000000000002",
      "productId": "000000000000000000000003",
      "variantId": "000000000000000000000004",
      "sku": "SKU-1",
      "quantity": 2,
      "value": 2000000
    }
  ]
}
```

Giới hạn baseline: 10 MB, 10.000 dòng, không trùng vị trí/sản phẩm/biến thể; hàng legacy thiếu variantId phân biệt bằng SKU. Với công ty lớn, chia baseline/phạm vi. Baseline được giữ trong bộ nhớ có giới hạn; dữ liệu database được duyệt cursor, kết quả ghi từng dòng. Vị trí không có trong file vẫn là `BASELINE_UNVERIFIED`, kể cả vị trí mới phát sinh. Baseline có dòng không còn balance sẽ được báo thiếu. Hash SHA-256 của file được lưu vào summary.

Chỉ dùng `--ledger-complete` **thay cho baseline** khi đã xác nhận ledger toàn bộ lịch sử trong phạm vi bao gồm tồn đầu kỳ/migration. Khi đó phép đối chiếu bắt đầu từ 0. Sự có mặt của một ledger `opening` không tự chứng minh toàn bộ lịch sử đã đầy đủ. Cờ này là xác nhận của người chạy, không phải kết luận do công cụ chứng minh.

## Kết quả

- `findings.jsonl`: mỗi dòng một finding có mức độ, mã lỗi, công ty/chi nhánh/kho/SKU, document ID và dữ liệu so sánh.
- `findings.csv`: cùng nội dung, UTF-8 BOM và chống công thức bảng tính trong ô văn bản.
- `summary.json`: chế độ baseline, snapshot timestamp, số bản ghi đã quét, số lỗi/review và `complete: true`. Tệp này chỉ ghi cuối lượt thành công. Nếu thiếu hoặc JSON chưa hoàn chỉnh, báo cáo chưa hoàn tất. File `.partial` cũng không phải báo cáo hoàn tất.

Exit code: `0` = không có finding trong phạm vi kiểm tra; `2` = có lỗi hoặc cần review; `1` = lỗi chạy/báo cáo chưa hoàn tất. Một phạm vi rỗng được báo cần review, không đánh dấu sạch.

Các kiểm tra: số tồn/giữ chỗ/giá vốn không hợp lệ; lượng và giá trị so baseline + ledger; máy `in_stock` so balance kho vật lý, `in_transit` so balance transit; scope/vị trí/SKU của máy; máy nội bộ so phiếu cấp phát và giá vốn; phiếu nhập xác nhận thiếu mã hoặc bằng chứng đăng ký; ledger thiếu balance/nguồn; phiếu hoàn thành thiếu/lệch ledger; liên kết đảo; lượng/giá vốn và từng chặng điều chuyển.

Nguồn ledger được đối chiếu tồn tại và chi nhánh: manual-stock-log, stock-log-reversal, goods-receipt, inventory-transfer, inventory-count, retail-order/retail_order, retail-after-sale và repair-ticket. Nguồn khác gắn `SOURCE_TYPE_UNVERIFIED`; opening không yêu cầu một chứng từ ứng dụng cụ thể. Kiểm tra này chưa đối chiếu toàn bộ công nợ hoặc trạng thái chứng từ retail/repair.

Máy nội bộ/sold/defective/repairing/lost/scrapped không được cộng như hàng bán được. Phiếu nhập lịch sử dùng máy + sự kiện đăng ký, không đòi máy hiện vẫn ở kho nhận; máy có thể đã bán/chuyển hợp lệ. Thiếu chứng cứ do migration/backfill là `review`, không tự sửa hay kết luận chắc chắn thiếu hàng. SKU theo lô mới được đối chiếu lượng/giá trị tổng, chưa đối chiếu từng lô. Dung sai tuyệt đối: lượng 0,000001; giá trị 0,01 đơn vị tiền.

Đây là báo cáo phục vụ xem xét dữ liệu. Không có chế độ `--fix`; việc xử lý lịch sử cần kế hoạch sửa riêng theo từng finding.
