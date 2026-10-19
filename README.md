# Kiểm Tra Online (Phiên bản đầy đủ)

App cho giáo viên tạo đề, học sinh làm bài, giáo viên xem kết quả + thời gian + số lần làm.

## Cách chạy trên máy tính

1. Cài Node.js (nếu chưa có)
2. Mở terminal trong thư mục này:
   ```
   npm install
   npm start
   ```
3. Mở trình duyệt: http://localhost:3000

## Cách dùng

- **Giáo viên tạo đề**: Vào trang chủ → nhập đề → tạo link
- **Học sinh làm bài**: Mở link `/exam/xxxxx` → nhập tên → làm bài → nộp
- **Xem kết quả**: Vào `/teacher` → chọn đề → xem bảng điểm (họ tên, điểm, thời gian, lần làm)

## Host miễn phí (để dùng trên điện thoại)

1. Đưa code lên GitHub
2. Deploy free trên:
   - [Render.com](https://render.com) (Web Service, Node)
   - [Railway.app](https://railway.app)
   - [Fly.io](https://fly.io)

Sau khi deploy, link sẽ có dạng: `https://ten-app.onrender.com/exam/abc123`

## Tính năng

- Trắc nghiệm ABCD + Đúng/Sai
- Tải file PDF đề
- Học sinh nhập tên
- Đếm thời gian làm bài
- Đếm số lần làm của từng học sinh
- Giáo viên xem bảng kết quả đầy đủ
