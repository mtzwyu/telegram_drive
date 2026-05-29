# ==========================================
# GIAI ĐOẠN 1: Build Frontend React + Vite
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Sao chép và cài đặt các dependency của frontend
COPY frontend/package.json ./
RUN npm install

# Sao chép mã nguồn frontend và build các file tĩnh
COPY frontend/ ./
RUN npm run build

# ==========================================
# GIAI ĐOẠN 2: Thiết lập Backend và chạy ứng dụng
# ==========================================
FROM node:20-alpine
WORKDIR /app

# Cài đặt các công cụ build cần thiết để biên dịch native dependencies (như better-sqlite3)
RUN apk add --no-cache python3 make g++ 

# Sao chép và cài đặt các dependency của backend
COPY backend/package.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Sao chép toàn bộ mã nguồn backend vào container
COPY backend/ ./

# Quay lại thư mục app gốc để tổ chức cấu trúc thư mục tĩnh
WORKDIR /app
# Sao chép file build từ Giai đoạn 1 vào thư mục public của backend
COPY --from=frontend-builder /app/frontend/dist ./public
# Sao chép file server chính của backend ra thư mục gốc hoặc giữ nguyên cấu trúc
RUN cp -r ./backend/* ./ && rm -rf ./backend

# Tạo thư mục lưu trữ dữ liệu database SQLite và file upload tạm thời
RUN mkdir -p /app/data /app/data/temp

EXPOSE 5000

# Khởi chạy ứng dụng
CMD ["node", "server.js"]
