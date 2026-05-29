/**
 * Script đăng nhập Telegram User Account một lần duy nhất.
 * Chạy: node backend/gen_session.js
 * Sau khi đăng nhập thành công, copy chuỗi SESSION STRING in ra và dán vào file .env
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
if (!process.env.TELEGRAM_API_ID) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

if (!API_ID || !API_HASH) {
  console.error('❌ Thiếu TELEGRAM_API_ID hoặc TELEGRAM_API_HASH trong file .env');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

(async () => {
  console.log('🔐 Đăng nhập Telegram User Account để lấy Session String...\n');

  const session = new StringSession(''); // Phiên mới trống
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: async () => await ask('📱 Nhập số điện thoại Telegram (VD: +84912345678): '),
    password: async () => await ask('🔒 Nhập mật khẩu 2FA (nếu có, bỏ trống nếu không): '),
    phoneCode: async () => await ask('📨 Nhập mã OTP vừa nhận trên Telegram: '),
    onError: (err) => console.error('Lỗi:', err),
  });

  const sessionString = client.session.save();

  console.log('\n✅ Đăng nhập thành công!');
  console.log('━'.repeat(60));
  console.log('📋 TELEGRAM_STRING_SESSION (copy toàn bộ dòng bên dưới):');
  console.log('━'.repeat(60));
  console.log(sessionString);
  console.log('━'.repeat(60));
  console.log('\n👉 Hãy dán chuỗi trên vào file .env dòng TELEGRAM_STRING_SESSION=...');

  rl.close();
  await client.disconnect();
  process.exit(0);
})();
