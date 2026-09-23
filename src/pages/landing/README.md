# Landing công khai

Mẫu Clarity đã được tích hợp vào `LandingPage.tsx`. Giữ routing hiện có tại `/`, `/landing`, `/landing.html` dành cho khách; không thay đổi đăng nhập, phân quyền hoặc các trang quản lý.

Đây là bộ mã landing chính thức duy nhất. Các bản demo độc lập, trang chọn mẫu, ảnh preview và script chuyển đổi tạm đã được loại bỏ; chỉnh sửa trực tiếp các file tại đây.

- `content.html`: HTML tĩnh đã duyệt, không nhận nội dung HTML từ API/người dùng. Nút tư vấn dùng email và liên kết pháp lý từ cấu hình thương hiệu.
- `landing.css`: selector giới hạn trong `.igen-landing`, tên animation có tiền tố riêng. Hai selector `:has(.igen-landing)` sửa overflow của html/body chỉ khi landing đang tồn tại để sticky hoạt động.
- `presentation.js`, `motion.js`: menu, hình minh họa, hiệu ứng mở đầu và nút giảm chuyển động ở footer.
- `phone.js`: mô hình 3D, tải động khi đến gần phần trình diễn; kéo chuột/cảm ứng, phím mũi tên, đổi màu, theo cuộn, giảm chuyển động và dự phòng không có WebGL.
- `lifetime.ts`: hủy listener, observer, animation và tài nguyên WebGL khi rời trang, hỗ trợ React StrictMode.

Three.js 0.180.0 được lưu trong `vendor/three`, giấy phép MIT kèm theo. Font Noto tại `assets`, giấy phép OFL. Không có yêu cầu tải tài nguyên 3D từ CDN khi xem trang.

Mô hình iPhone 18 Pro là bản dựng hình học minh họa từ mẫu đã duyệt, không phải CAD chính thức. Bốn vật liệu Glacier, Silver, Black, Burgundy dùng màu ước lượng. Hình điện thoại ở hero vẫn là minh họa iGen của mẫu Clarity.
