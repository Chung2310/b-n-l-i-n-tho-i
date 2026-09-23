# Nâng cấp Tài chính

Mọi thay đổi nằm trong `server/modules/finance` và `src/modules/finance`.
Bán lẻ, kho, phiếu nhập, giá bán và IMEI chỉ được đọc bằng model hiện có.
Không sửa chứng từ nguồn, không đổi cấu hình hệ thống hoặc danh mục quyền chung.

## Chức năng

- Tổng quan mặc định cho quản lý tài chính: doanh thu hàng hóa, giá vốn, lãi gộp,
  lãi ròng quản trị, tồn kho, nợ và diễn biến theo ngày.
- Công nợ: tổng hợp khách hàng, mở chứng từ để thu tiền bằng chức năng cũ;
  tạo phiếu ghi nợ NCC có mã riêng qua Ghi nợ → chọn phiếu nhập đã xác nhận; trả NCC tạo phiếu chi đồng thời.
- Tuổi nợ tính từ hạn trả tại thời điểm xem: chưa quá hạn, 1–7, 8–15, 16–30,
  31–60, trên 60 ngày. Báo cáo nhóm cũ vẫn nằm trong mục mở rộng.
- Nhắc nợ nội bộ: lọc quá hạn/hôm nay/3/5/7 ngày, lưu trạng thái xử lý,
  hẹn trả, người phụ trách và ghi chú. Không gửi mới qua Marketing;
  lệnh retry chỉ nhận kênh nội bộ.
- Thu–chi: phiếu mới, đối chiếu thanh toán bán lẻ, thu nợ trực tiếp, hoàn tiền,
  mua lại máy; lọc và xuất CSV. Trả NCC không ghi thêm giá vốn vào lãi lỗ.
- Lãi lỗ: nhóm theo sản phẩm, IMEI, nhân viên, chi nhánh đang chọn, nhóm hàng,
  thương hiệu; bán dưới giá vốn; tuổi tồn và nguy cơ trượt giá của IMEI còn kho.
- VAT: nhập chứng từ hoặc xác nhận dữ liệu từ hóa đơn bán lẻ đã phát hành;
  kiểm tra chi nhánh, chống trùng; chuyển kỳ được khai báo theo tháng.
- Hòa vốn: ngân sách chi phí cố định theo tháng, tỷ lệ đóng góp sau biến phí,
  doanh thu còn thiếu, tiến độ và dự tính số ngày; thiếu dữ liệu không trả số giả.
- Tài sản: thêm nhà cung cấp, bộ phận, ngày mua và trạng thái sửa/mất/hỏng;
  KPI tổng giá trị; khấu hao hiện tên tài sản, giá trị còn lại, lọc và xuất CSV;
  KPI kiểm kê bổ sung. Giữ các nghiệp vụ cũ.
- Ghi sổ khấu hao trong transaction, yêu cầu số dư kỳ trước khớp; không cho
  kỳ cũ ghi đè giảm khấu hao lũy kế. Lập kế hoạch không ghi đè dòng đã ghi sổ.

## Quyền và dữ liệu

- Các báo cáo mới, giá vốn, lãi lỗ, chi phí lương, VAT và phiếu thu–chi yêu cầu
  `finance-wallet:manage` (admin có quyền như cơ chế hiện tại).
- Công nợ/nhắc nợ dùng quyền công nợ hiện có; tài sản dùng quyền tài sản hiện có.
- Chưa thêm các permission chi tiết mới vào hệ thống phân quyền chung vì phạm vi
  yêu cầu không cho sửa module đó. Không tự cấp quyền theo tên vai trò.
- Mỗi request lấy công ty/chi nhánh từ người dùng đã xác thực. Phần thân request
  không được phép chỉ định công ty/chi nhánh khác.
- Các collection Finance mới được tạo khi có dữ liệu. Dùng MongoDB transaction
  như sổ công nợ hiện có; môi trường MongoDB cần hỗ trợ transaction.

## Quy tắc và giới hạn cần hiểu khi sử dụng

- Doanh thu hiện lấy hàng hóa bán lẻ xác nhận/hoàn tất và hoàn hàng trong kỳ;
  chưa tổng hợp doanh thu dịch vụ sửa chữa hoặc phân bổ các khoản khác.
- Lãi ròng là số quản trị: trừ chi phí đã nhập và khấu hao đã ghi sổ (phân bổ
  theo số ngày của kỳ được chọn); chưa gồm chi phí chưa nhập và thuế thu nhập.
- Giá vốn ưu tiên snapshot dương trên đơn, rồi phiếu xuất khớp đơn/dòng/sản phẩm/số lượng, rồi phiếu nhập trước khi bán khớp duy nhất từng IMEI/mã nội bộ. Không lấy giá hiện tại hoặc chọn tùy phiếu nhập. Thiết bị đã có lần bán trước không tự dùng lại giá nhập đầu tiên.
- Giá vốn 0/thiếu chưa có bằng chứng hợp lệ được đánh dấu chưa xác định. Tổng giá vốn, lãi gộp, lãi ròng và hòa vốn không được tính nếu có dòng thiếu giá vốn; bảng nhóm, biểu đồ và CSV giữ trạng thái thiếu dữ liệu.
- Hàng tồn: giá nhập IMEI đọc từ phiếu nhập khớp số serial/mã nội bộ; giá chào
  bán lấy bảng giá hiện tại. Thiếu nguồn hiện “Chưa có dữ liệu”. Tổng tồn kho
  lấy số lượng và giá bình quân sổ kho, không cộng thêm giá trị IMEI lần nữa.
- Phải trả: cần xác nhận số đã thanh toán trước lúc theo dõi và hạn trả;
  hạn trả và số đầu kỳ được lưu riêng trên phiếu ghi nợ Tài chính, không cập nhật phiếu nhập kho; số đầu kỳ không tạo thêm phiếu chi. Phiếu nhập chưa xác nhận công nợ được cảnh báo.
- Dòng tiền bỏ qua các bút toán nhập từ sự kiện bán lẻ/legacy để không cộng trùng
  với lịch sử thanh toán nguồn. Phiếu nhập kho không tự được xem là đã trả tiền.
- VAT là sổ nội bộ. Hóa đơn bán lẻ cần người có quyền xác nhận trước khi đưa vào
  sổ; không tự xác định điều kiện khấu trừ hoặc thuế suất theo luật.
- Ngân sách cố định sử dụng các tháng nằm trong kỳ. Chuyển VAT dùng tháng đầu kỳ;
  người dùng cần đối chiếu số chuyển kỳ với sổ đã chốt. Không tự chuyển kỳ lịch sử.
- Báo cáo giới hạn tối đa 366 ngày và 10.000 bản ghi cho mỗi nguồn; nếu vượt sẽ
  báo lỗi yêu cầu thu hẹp phạm vi, không âm thầm bỏ bớt dữ liệu.
- Tệp đính kèm phiếu thu–chi hiện lưu liên kết HTTPS; không thêm trình upload
  hoặc sửa module quản lý tệp.

## Kiểm thử

`management.test.ts` dùng MongoDB replica set tạm: thanh toán nguyên tử, trả
vượt dư nợ, yêu cầu trùng, thanh toán đồng thời, cách ly chi nhánh, VAT chống
trùng và không sửa nguồn, báo cáo tiền/lãi lỗ, ghi sổ khấu hao theo thứ tự.
`FinancialManagementPage.test.tsx` kiểm tra lấy dữ liệu, lọc ngày, giữ khóa
idempotency khi gửi lại và không hiện số 0 giả khi API lỗi.

Không có migration, commit hoặc push tự động kèm theo phần nâng cấp này.


### Đối chiếu giá vốn tại Tài chính
- Chỉ đọc dữ liệu Kho/Bán hàng, không cập nhật chứng từ nguồn.
- Máy bán lại: đối chiếu đúng IMEI/mã và phiếu thu mua sau lần bán trước, kiểm chứng dòng nhập kho; dùng giá thu mua, không tái dùng giá nhập đầu tiên.
- Hàng theo số lượng: tái tính bình quân từ lịch sử cùng công ty, chi nhánh, kho, biến thể/SKU đến dòng xuất bán; xác thực dòng nhập với phiếu nhập. Không dùng bình quân tồn kho hiện tại.
- Lịch sử thiếu, âm kho, nhập không rõ giá, nguồn không hỗ trợ hoặc thời điểm nhập/xuất không phân định được: giữ trạng thái chưa đủ dữ liệu, không tự gán 0.


### Sửa sai và giới hạn nghiệp vụ
- Phiếu thu/chi được đảo bằng chứng từ mới có lý do và ngày điều chỉnh; không xóa phiếu gốc. Trả NCC khôi phục dư nợ nguyên tử, ngăn đảo trùng.
- Đảo chi phí ghi âm chi phí tại ngày điều chỉnh; kỳ gốc giữ nguyên.
- VAT một mức thuế suất phải khớp giá trị trước thuế × thuế suất làm tròn VND. Chứng từ nhiều mức cần tách phù hợp trước khi ghi nhận.
- Nợ hiện tại được ghi nhãn rõ; chưa phải báo cáo số dư chốt cuối kỳ. Nhắc nợ/tuổi nợ ẩn khoản dư nợ 0, Công nợ giữ lịch sử.
- Kiểm kê tài sản giới hạn trong chi nhánh; phiên nhiều chi nhánh chỉ truy cập bằng phạm vi toàn công ty được cấp phép.
- Các việc đối chiếu hoàn hàng/nhập xuất và tồn kho được để lại chờ module Kho hoàn thiện.
