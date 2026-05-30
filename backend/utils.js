import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pipeline } from 'stream/promises';

// Load biến môi trường từ file .env nếu chạy ở chế độ dev local
dotenv.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

// Tự động sinh khóa mã hóa ENCRYPTION_KEY nếu chưa có
if (!process.env.ENCRYPTION_KEY) {
  const newKey = crypto.randomBytes(32).toString('hex');
  let envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '..', '.env');
  }
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  envContent += `\n# --- Encryption Key (Tự động sinh - KHÔNG ĐƯỢC XÓA!) ---\nENCRYPTION_KEY=${newKey}`;
  fs.writeFileSync(envPath, envContent, 'utf8');
  process.env.ENCRYPTION_KEY = newKey;
  console.log('🔐 Đã tự động sinh ENCRYPTION_KEY và lưu vào .env từ utils.js');
}

/**
 * Loại bỏ dấu tiếng Việt khỏi chuỗi ký tự.
 * @param {string} str Chuỗi gốc có dấu
 * @returns {string} Chuỗi không dấu
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  
  // Xử lý các tổ hợp dấu unicode động
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // dấu huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // mũ ô, mũ â, mũ ơ/ư
  
  // Loại bỏ các ký tự đặc biệt thừa thãi
  return str.trim();
}

/**
 * Chuẩn hóa chuỗi dùng để tìm kiếm (không dấu, viết thường, loại bỏ ký tự đặc biệt).
 * @param {string} str Chuỗi tìm kiếm gốc
 * @returns {string} Chuỗi tìm kiếm chuẩn hóa
 */
export function normalizeSearchString(str) {
  if (!str) return '';
  const noTones = removeVietnameseTones(str).toLowerCase();
  // Giữ lại chữ cái, số và khoảng trắng, chuyển ký tự đặc biệt thành dấu cách
  return noTones
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân loại định dạng file dựa vào MIME type hoặc đuôi mở rộng.
 * @param {string} mimeType Định dạng MIME của file
 * @param {string} fileName Tên file
 * @returns {string} Danh mục phân loại: document, image, video, audio, archive, other
 */
export function categorizeFile(mimeType, fileName) {
  if (!mimeType) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mapping = {
      'pdf': 'document', 'doc': 'document', 'docx': 'document', 'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document', 'txt': 'document', 'epub': 'document',
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
      'mp4': 'video', 'mkv': 'video', 'avi': 'video', 'mov': 'video', 'webm': 'video',
      'mp3': 'audio', 'm4a': 'audio', 'wav': 'audio', 'flac': 'audio', 'ogg': 'audio',
      'zip': 'archive', 'rar': 'archive', 'tar': 'archive', 'gz': 'archive', '7z': 'archive'
    };
    return mapping[ext] || 'other';
  }

  const mime = mimeType.toLowerCase();
  if (mime.includes('image')) return 'image';
  if (mime.includes('video')) return 'video';
  if (mime.includes('audio')) return 'audio';
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('powerpoint') ||
    mime.includes('text') ||
    mime.includes('office')
  ) {
    return 'document';
  }
  if (
    mime.includes('zip') ||
    mime.includes('rar') ||
    mime.includes('archive') ||
    mime.includes('compressed') ||
    mime.includes('x-7z-compressed')
  ) {
    return 'archive';
  }
  return 'other';
}

/**
 * Định dạng dung lượng file thành dạng dễ đọc.
 * @param {number} bytes Dung lượng dạng byte
 * @returns {string} Dung lượng dễ đọc (ví dụ: 1.2 MB)
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Lấy hoặc băm khóa mã hóa
export const getEncryptionKey = () => {
  const keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) {
    throw new Error('Thiếu ENCRYPTION_KEY trong biến môi trường!');
  }
  return crypto.createHash('sha256').update(keyStr).digest();
};

/**
 * Mã hóa buffer bằng AES-256-GCM.
 * Định dạng: [12-byte IV] + [16-byte Auth Tag] + [Encrypted Data]
 */
export function encryptBuffer(buffer) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Giải mã buffer bằng AES-256-GCM.
 */
export function decryptBuffer(buffer) {
  if (buffer.length < 28) {
    throw new Error('Dữ liệu đã mã hóa không hợp lệ hoặc quá ngắn');
  }
  const key = getEncryptionKey();
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encryptedData = buffer.subarray(28);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Mã hóa text sang base64 gói GCM.
 */
export function encryptText(text) {
  if (!text) return '';
  const encryptedBuf = encryptBuffer(Buffer.from(text, 'utf8'));
  return encryptedBuf.toString('base64');
}

/**
 * Giải mã text base64 gói GCM.
 */
export function decryptText(encryptedText) {
  if (!encryptedText) return '';
  const decryptedBuf = decryptBuffer(Buffer.from(encryptedText, 'base64'));
  return decryptedBuf.toString('utf8');
}

/**
 * Cập nhật cấu hình file .env
 */
export function updateEnvFile(key, value) {
  let envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '..', '.env');
  }

  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

/**
 * Mã hóa tệp tin trực tiếp trên đĩa bằng luồng (Streaming) để tránh tràn RAM (OOM).
 * Định dạng: [12-byte IV] + [16-byte Auth Tag] + [Encrypted Data]
 */
export async function encryptFileOnDisk(srcPath, destPath) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const readStream = fs.createReadStream(srcPath);
  const writeStream = fs.createWriteStream(destPath);

  // Ghi IV và Placeholder Tag (16 bytes) trước
  writeStream.write(iv);
  writeStream.write(Buffer.alloc(16));

  // Thực hiện stream mã hóa phần còn lại của file
  await pipeline(readStream, cipher, writeStream);

  // Lấy Auth Tag sau khi stream kết thúc
  const tag = cipher.getAuthTag();

  // Mở file ở chế độ đọc ghi để điền lại Auth Tag vào đúng offset 12
  const fd = fs.openSync(destPath, 'r+');
  fs.writeSync(fd, tag, 0, 16, 12);
  fs.closeSync(fd);
}

/**
 * Giải mã tệp tin trực tiếp trên đĩa bằng luồng (Streaming).
 */
export async function decryptFileOnDisk(srcPath, destPath) {
  const key = getEncryptionKey();

  // Đọc IV và Tag từ 28 bytes đầu tiên
  const fd = fs.openSync(srcPath, 'r');
  const iv = Buffer.alloc(12);
  const tag = Buffer.alloc(16);
  fs.readSync(fd, iv, 0, 12, 0);
  fs.readSync(fd, tag, 0, 16, 12);
  fs.closeSync(fd);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  // Đọc từ offset 28
  const readStream = fs.createReadStream(srcPath, { start: 28 });
  const writeStream = fs.createWriteStream(destPath);

  await pipeline(readStream, decipher, writeStream);
}
