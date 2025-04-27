# Hệ thống Phát hiện Đỗ xe Trái phép

Hệ thống phát hiện đỗ xe trái phép là một ứng dụng web sử dụng trí tuệ nhân tạo và xử lý hình ảnh để phát hiện và theo dõi các phương tiện đỗ xe trái phép trong các khu vực được chỉ định.

## Tính năng chính

- **Phát hiện phương tiện thời gian thực**: Sử dụng YOLOv8 để phát hiện ô tô, xe buýt và xe tải
- **Vẽ khu vực đỗ xe**: Cho phép người dùng vẽ và định nghĩa các khu vực đỗ xe được phép
- **Phát hiện vi phạm**: Tự động phát hiện và cảnh báo khi phương tiện đỗ quá thời gian quy định
- **Thống kê và biểu đồ**: Hiển thị dữ liệu thống kê về số lượng phương tiện và vi phạm
- **Giao diện thân thiện**: Giao diện người dùng trực quan với chế độ tối/sáng
- **Tương thích đa thiết bị**: Hoạt động trên máy tính và thiết bị di động

## Công nghệ sử dụng

- **Backend**: Python, Flask
- **Computer Vision**: OpenCV, YOLOv8 (Ultralytics)
- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Đồ thị**: Chart.js
- **Triển khai**: Vercel

## Yêu cầu hệ thống

- Python 3.11
- Camera hoặc webcam
- Trình duyệt web hiện đại

## Cài đặt

1. Clone repository:
```bash
git clone https://github.com/Youth-Garden-School/ilegal-packing-check
cd illegal-Parking-Detection
```
2. Cài đặt các package cần thiết:
```bash
pip install -r requirements.txt
```
3. Chạy ứng dụng:
```bash
python app.py
```
4. Truy cập ứng dụng tại: :
```bash
http://localhost:5000
```