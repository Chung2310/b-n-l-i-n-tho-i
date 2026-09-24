# Báo cáo tài chính mở rộng

## Truy cập
Tài chính → Báo cáo tài chính: Công nợ tổng hợp, Thuế VAT, Lãi lỗ / Xả lỗ, Điểm hòa vốn. Quyền đọc `finance-wallet:read` hoặc `finance-wallet:manage`; mọi thao tác ghi cần `finance-wallet:manage`. API `/finance/reporting` nằm sau xác thực và cổng module finance. Phạm vi công ty/chi nhánh lấy từ phiên đăng nhập; không nhận phạm vi từ nội dung biểu mẫu. Thay đổi chi nhánh hệ thống tải lại báo cáo, hủy yêu cầu đọc cũ và đóng biểu mẫu cũ.

## Công nợ và nhắc nợ
- Tổng hợp khoản phải thu Finance đang mở; bổ sung đơn bán lẻ chưa có bản ghi Finance và phiếu sửa chữa hoàn tất chưa thu đủ. Khử trùng theo nguồn đơn. Nhóm Khách/Đại lý/CTV dựa liên kết `Partner.customerId` hoặc nhóm được khai báo trên khoản nợ bổ sung.
- Không diễn giải số dư hoa hồng âm thành khoản vay phải thu: khoản CTV cần thu riêng được ghi nhận rõ chứng từ và hạn trả.
- Phải trả NCC được ghi nhận qua popup; có thể đối soát từ phiếu nhập đã xác nhận. Chỉ nhập khoản còn nợ sau thanh toán trước đó. Nhập 0 để xác nhận phiếu nhập đã trả đủ. Không tự coi phiếu nhập cũ chưa có lịch thanh toán là nợ chưa trả.
- Không ghi lại bằng tay khoản đã tồn tại ở Bán lẻ/Sửa chữa/Công nợ Finance. Nợ bổ sung lưu lịch sử thu/chi, người ghi nhận, tham chiếu và khóa giao dịch. Cập nhật số dư bằng phiên bản và điều kiện số dư nguyên tử để ngăn chi vượt/nộp trùng.
- Tuổi nợ tính theo ngày Việt Nam tại thời điểm xem: chưa có hạn trả, chưa đến hạn, đến hạn hôm nay, quá hạn 1–30, 31–60, 61–90, trên 90 ngày. Đây là số dư hiện tại, không giả định số dư lịch sử.
- Bộ lọc cảnh báo NCC chọn 3/4/5 ngày. Lịch nhắc nội bộ hằng ngày từ 08:15, nhắc NCC trong 5 ngày trước hạn, ngày đến hạn và khi quá hạn. Chống trùng theo ngày/khoản nợ/người nhận. Worker chỉ xử lý chi nhánh hoạt động và công ty bật finance. Khoản phải thu đã có ở Finance tiếp tục dùng worker nhắc nợ hiện có.
- Không tự gửi email/Zalo/SMS trong tính năng này; thông báo gửi cho người có quyền tài chính trong ứng dụng.

## VAT
- Báo cáo theo phương pháp khấu trừ; không áp đặt thuế suất. Kế toán ghi đúng giá trị trước thuế, VAT trên hóa đơn và VAT đầu vào đủ điều kiện khấu trừ. Phiếu bán/nhập kho không tự được coi là hóa đơn hợp lệ.
- Có bảng kê vào/ra và CSV theo tháng hoặc quý. Thuế phải nộp = max(0, VAT đầu ra − VAT đầu vào đủ điều kiện − khấu trừ đầu kỳ). Chuyển kỳ sau = max(0, khấu trừ đầu kỳ + VAT đầu vào đủ điều kiện − VAT đầu ra).
- Số đầu kỳ được xác nhận riêng theo kỳ kê khai và có kiểm soát phiên bản. Không tự cộng số dư tháng vào số dư quý để tránh đếm đôi. Chưa xác nhận được đánh dấu trên màn hình.
- Hóa đơn điều chỉnh có liên kết hóa đơn gốc cùng công ty/chi nhánh/chiều/MST, không được trước ngày hóa đơn gốc; hỗ trợ số âm. VAT khấu trừ phải cùng dấu và trị tuyệt đối không vượt VAT đầu vào. Chống trùng hóa đơn đầu vào theo MST/ký hiệu/số; đầu ra theo công ty/ký hiệu/số.
- Mã số thuế đầu vào bắt buộc. Đầu ra có thể để trống MST người tiêu dùng. Báo cáo là bảng kê nội bộ dựa trên chứng từ nhập, chưa phải tích hợp gửi tờ khai thuế hoặc tự kiểm tra điều kiện pháp lý khấu trừ.

## Lãi lỗ, giá vốn và xả lỗ
- Chọn ngày X–Y, tháng, quý hoặc năm theo múi giờ Việt Nam. Bán lẻ ghi nhận khi xác nhận giao hàng/xuất kho, kể cả chưa thu đủ, loại VAT đầu ra và giữ chi phí hàng bán trong snapshot gốc.
- Chiết khấu đơn được phân bổ xuống dòng hàng với chênh lệch làm tròn vào dòng cuối; phí vận chuyển là dòng riêng. Bán dưới giá vốn hiện thành dòng âm. Nhập 18 triệu, doanh thu chưa VAT 16,5 triệu → lãi gộp -1,5 triệu. Khoản âm đã có trong lãi gộp, không ghi thêm chi phí lần nữa.
- Trả hàng đảo doanh thu và giá vốn theo ngày trả, phân bổ VAT theo tỷ lệ phần hàng hóa gốc (không chia trên phí vận chuyển). Hủy đơn đảo phần còn lại sau các lần trả trước đó. Thu mua lại là mua hàng mới, không đảo doanh thu đơn gốc.
- Bổ sung sửa chữa hoàn tất và bán trực tiếp từ kho; loại phiếu kho được sinh từ đơn bán lẻ để tránh cộng đôi. Nguồn chưa tách VAT riêng được cảnh báo. Đơn thiếu giá vốn/giá bán gốc không bị mặc định chi phí 0: loại khỏi phép tính và báo thiếu dữ liệu.
- Chi phí thực tế lấy khoản chi đã xác nhận; hoa hồng lấy earning/reversal/KPI phát sinh, không cộng lần chi payout. Lương lấy các dòng đã chốt qua bộ đọc snapshot chính thức, bao gồm chi phí người sử dụng lao động nếu có. Khấu hao lấy bản ghi đã posted. Lương/khấu hao phân bổ đều theo ngày trong tháng khi lọc ngày lẻ; nguồn snapshot lỗi được cảnh báo và không đoán số.
- Lợi nhuận ròng đã ghi nhận = doanh thu − giá vốn − mặt bằng − lương − hoa hồng − các chi phí khác − chi phí thuế TNDN đã nhập. Chưa tự quyết toán TNDN. Chi phí ngoài bảng lương nhập riêng, không nhập lại bảng lương đã chốt.
- Phần xả lỗ là lỗ đã thực hiện khi bán; chưa tự lập dự phòng giảm giá cho hàng vẫn còn tồn. Báo cáo không thay thế bộ BCTC pháp định đầy đủ.

## Hòa vốn
- Cấu hình theo từng tháng/chi nhánh: mặt bằng, lương, định phí khác; giá bán/giá vốn bình quân một máy chưa VAT; hoa hồng dự kiến và biến phí khác một máy.
- Lãi đóng góp dự kiến/máy = giá bán − giá vốn − hoa hồng dự kiến − biến phí khác. Máy hòa vốn = ceil(định phí / lãi đóng góp); doanh thu hòa vốn = ceil(định phí / tỷ lệ lãi đóng góp).
- Nếu lãi đóng góp không dương và có định phí, kết quả không xác định thay vì cho mục tiêu âm hoặc vô hạn. Dự toán không tạo khoản chi thực tế.
- Mốc ngày đầu hòa vốn dùng lãi gộp thực tế lũy kế trừ hoa hồng thực tế và biến phí khác ước tính theo số máy. Hiển thị riêng ngày đầu đạt và trạng thái hiện tại vì trả hàng/xả lỗ sau đó có thể làm mất hòa vốn. Không đồng nhất với ngày dòng tiền về.

## Tài liệu tham chiếu
- Luật Thuế GTGT: https://vanban.chinhphu.vn/?classid=1&docid=212476&orggroupid=1&pageid=27160 — dùng làm cơ sở phân biệt đầu vào/đầu ra và phương pháp khấu trừ; điều kiện pháp lý thực tế cần đối chiếu văn bản sửa đổi và chứng từ của doanh nghiệp, không hard-code trong ứng dụng.
- Bộ Tài chính, phân biệt dự phòng giảm giá hàng tồn kho: https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/115540 — việc giảm giá bán không tự đồng nghĩa với bút toán dự phòng.

## Kiểm thử
Kiểm thử tính toán thuần, MongoDB tạm và HTTP cục bộ; không dùng dữ liệu thật, không gửi thông báo thật, không bật/chạy scheduler sản xuất trong quá trình phát triển. Kiểm tra cách ly tenant/chi nhánh, phân quyền đọc/ghi, trùng thanh toán, số âm, thời điểm hoàn/hủy, biên tuổi nợ, VAT kỳ/điều chỉnh và popup báo cáo.

## Sổ quỹ và kiểm soát dòng tiền
- Tài chính → Sổ quỹ & dòng tiền. Tách tiền mặt/ngân hàng khỏi ví Credit của dịch vụ AI. Khai báo số dư ngay trước các giao dịch của ngày bắt đầu; không gán lại giao dịch đã nằm trong số dư đầu kỳ.
- Lập phiếu thu, chi, chuyển quỹ ở trạng thái chờ duyệt. Người có quyền `finance-wallet:manage` duyệt hoặc từ chối, lưu người lập/người duyệt/thời gian/lý do. Quyền này có thể duyệt phiếu do chính mình lập; chưa áp dụng bắt buộc hai người độc lập hay hạn mức duyệt theo chức danh.
- Duyệt ghi tiền và thanh toán nợ bổ sung trong cùng một MongoDB transaction. Sử dụng khóa giao dịch, phiên bản và chỉ mục nguồn để tránh ghi hai lần. Chặn số dư âm khi chi/chuyển quỹ. MongoDB cần replica set hoặc sharded cluster hỗ trợ transaction, không tự hạ xuống ghi nhiều bước không nguyên tử.
- Giao dịch nguồn tổng hợp từ thu/hoàn bán lẻ, mua lại hàng, thanh toán công nợ, lương đã trả, hoa hồng payout và tiền đã trả trên phiếu nhập. Chưa biết tài khoản thực tế thì hiện trong danh sách chờ gán quỹ; không đoán cash/bank. Gán nguồn không thu tiền hoặc thanh toán nợ lần nữa. Các khoản thu Finance được tạo từ sự kiện retail không cộng trùng với thanh toán trên đơn bán lẻ.
- Chứng từ nguồn thay đổi/hủy sau khi ghi quỹ được cảnh báo để đối soát; không tự xóa phiếu đã ghi sổ. Phiếu điều chỉnh là chứng từ mới có tham chiếu, qua duyệt như phiếu thông thường.
- Dự báo 7/14/30 ngày theo công nợ có hạn trả, quá hạn đưa vào ngày hiện tại. Hiển thị cả kịch bản chưa thu được nợ. Không mặc định các khoản phải thu chắc chắn sẽ thu; chưa dự báo khoản lương/thuế/thuê nhà chưa lập nghĩa vụ thanh toán. Khoản chưa có hạn, phiếu nhập chưa đối soát và giao dịch chưa gán quỹ được báo rõ. Phiếu chờ duyệt không được tính như tiền đã trả.
- Ghi kết quả kiểm kê/đối soát so với phiên bản số dư hiện hành; chênh lệch không tự thay đổi tiền. Có thể ghi từng dòng sao kê ngân hàng và ghép với phiếu đã ghi sổ đúng tài khoản, đúng số tiền có dấu. Không kết nối trực tiếp ngân hàng, không tự suy đoán ghép theo số tiền giống nhau.
- Chốt tháng lưu ảnh chụp số dư cuối tháng và lịch sử lý do/người chốt. Không cho ghi tiền vào tháng đó hoặc trước tháng đó khi có kỳ sau đã chốt. Không chốt khi còn phiếu chờ duyệt từ đầu sổ đến cuối kỳ. Mở lại cần lý do và phiên bản; giữ ảnh chụp các lần chốt trước. **Đây là khóa sổ thu/chi, chưa phải khóa toàn bộ bán hàng/kho/lương/VAT hoặc khóa BCTC pháp định.**

## Liên thông phiếu nhập và chất lượng báo cáo
- Phiếu nhập mới có tùy chọn tự ghi nợ, hạn trả và số tiền đã trả. Khi hoàn tất nhập kho, tạo một khoản phải trả gắn nguồn duy nhất = giá trị phiếu − số đã trả. Xác nhận lại không tạo thêm nợ. Phiếu nhập cũ không có thông tin tài chính tiếp tục cần đối soát, không tự suy diễn còn nợ.
- Chi phí dùng để tính lợi nhuận là chi phí phát sinh; lập phiếu chi tiền không tự tạo chi phí lần nữa. Cần ghi chi phí ở báo cáo tài chính và thanh toán ở sổ quỹ đúng chứng từ.
- Lãi lỗ hiển thị trạng thái tạm tính/chưa đủ dữ liệu ở trước chỉ số và trong CSV; không gắn nhãn “đầy đủ” chỉ vì phép tính chạy được. Có chi tiết chi phí phân bổ và mở chứng từ nguồn được kiểm tra công ty/chi nhánh.
- Hòa vốn hỗ trợ cơ cấu số lượng điện thoại/phụ kiện/lượt sửa chữa (tổng tỷ trọng 100%), lãi đóng góp bình quân có trọng số, số lượng ước tính từng nhóm và đối chiếu dự toán/chi phí đã ghi nhận. Biến phí ước tính theo nhóm được đảo khi trả/hủy. Hàng trực tiếp từ kho chưa có phân nhóm vẫn được cảnh báo; cơ cấu là giả định kinh doanh, không phải dự báo chắc chắn.
- Kiểm thử bổ sung dùng MongoMemoryReplSet: duyệt đồng thời, nguyên tử chuyển quỹ/công nợ, chống chi vượt và nguồn trùng, khóa/mở kỳ giữ lịch sử, đối soát, ghép ngân hàng, phục hồi liên thông NCC, phạm vi dữ liệu và popup phân quyền/đổi chi nhánh.
