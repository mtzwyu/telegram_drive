import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load biến môi trường từ file .env nếu chạy ở chế độ dev local
dotenv.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

import routes from './routes.js';
import { dbService } from './db.js';
import { getClient } from './telegramClient.js';

const PORT = process.env.PORT || 5000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').map(id => id.trim());
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const WEB_URL = process.env.WEB_URL || 'http://localhost:5000';

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('⚠️ Cảnh báo: Thiếu TELEGRAM_BOT_TOKEN trong biến môi trường (chức năng đăng nhập Mini App sẽ không hoạt động).');
}

// -------------------------------------------------------------
// 1. Cấu hình Express Web Server
// -------------------------------------------------------------
const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Middleware để truyền mock bot sang routes (không dùng bot chat)
app.use((req, res, next) => {
  req.bot = null;
  next();
});

// Định tuyến các API
app.use('/api', routes);

// Phục vụ giao diện Frontend (sẽ được copy vào thư mục public sau khi build)
const publicPath = path.join(process.cwd(), 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  // Bất kỳ route nào không khớp API sẽ trả về index.html (cho Single Page App React)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // Dự phòng nếu chưa build frontend
  app.get('/', (req, res) => {
    res.send('Máy chủ Telegram Drive API đang chạy. Vui lòng build và copy frontend vào thư mục public.');
  });
}

// Khởi chạy Express Server
app.listen(PORT, () => {
  console.log(`🚀 Web Server đang chạy trên port: ${PORT}`);
});

// Khởi tạo Telegram User Client (MTProto) để upload/download file
getClient()
  .then(() => {
    console.log('📡 Telegram User Client (MTProto) đã khởi tạo thành công!');
  })
  .catch((err) => {
    console.warn('⚠️ Không thể khởi tạo Telegram User Client. Upload/Download sẽ không hoạt động cho đến khi cấu hình TELEGRAM_STRING_SESSION trong .env');
    console.warn('   Chạy: node backend/gen_session.js để tạo session.');
  });

export default app;
