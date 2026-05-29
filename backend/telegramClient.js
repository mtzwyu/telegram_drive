/**
 * Module quản lý Telegram User Client (MTProto) — dùng để upload file lên Saved Messages.
 * Sử dụng thư viện `telegram` (GramJS).
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { encryptText, decryptText, encryptBuffer, decryptBuffer, updateEnvFile, encryptFileOnDisk, decryptFileOnDisk } from './utils.js';
import { CustomFile } from 'telegram/client/uploads.js';

dotenv.config();
if (!process.env.TELEGRAM_API_ID) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

let clientInstance = null;
let isConnected = false;

/**
 * Lấy singleton Telegram User Client đã kết nối.
 */
export async function getClient() {
  if (clientInstance && isConnected) {
    return clientInstance;
  }

  let sessionStr = process.env.TELEGRAM_STRING_SESSION || '';
  if (!API_ID || !API_HASH || !sessionStr) {
    throw new Error(
      'Thiếu TELEGRAM_API_ID, TELEGRAM_API_HASH hoặc TELEGRAM_STRING_SESSION trong .env. ' +
      'Hãy đăng nhập bằng SĐT/QR trên Web Dashboard hoặc chạy `node backend/gen_session.js` để tạo session trước.'
    );
  }

  // Giải mã hoặc di trú session
  if (sessionStr.startsWith('enc:')) {
    try {
      sessionStr = decryptText(sessionStr.slice(4));
    } catch (e) {
      console.error('❌ Lỗi giải mã TELEGRAM_STRING_SESSION. Có thể ENCRYPTION_KEY không khớp hoặc bị thay đổi.');
      throw e;
    }
  } else {
    // Tự động mã hóa session cũ và lưu lại
    try {
      const encryptedSession = 'enc:' + encryptText(sessionStr);
      updateEnvFile('TELEGRAM_STRING_SESSION', encryptedSession);
      process.env.TELEGRAM_STRING_SESSION = encryptedSession;
      console.log('🔒 Đã tự động di trú và mã hóa TELEGRAM_STRING_SESSION cũ trong .env');
    } catch (err) {
      console.warn('⚠️ Gặp lỗi khi tự động di trú session:', err.message);
    }
  }

  const session = new StringSession(sessionStr);
  clientInstance = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await clientInstance.connect();
  isConnected = true;
  console.log('📡 Telegram User Client (MTProto) đã kết nối thành công!');
  return clientInstance;
}

/**
 * Ngắt kết nối client cũ, cập nhật session mới và kết nối lại.
 * @param {string} newSessionString - Chuỗi session mới
 */
export async function updateSessionAndReconnect(newSessionString) {
  if (clientInstance) {
    try {
      console.log('📡 Đang ngắt kết nối Telegram Client cũ...');
      await clientInstance.disconnect();
    } catch (e) {
      console.warn('⚠️ Gặp lỗi khi ngắt kết nối client cũ:', e.message);
    }
  }

  clientInstance = null;
  isConnected = false;

  let sessionToSave = newSessionString;
  if (newSessionString && !newSessionString.startsWith('enc:')) {
    sessionToSave = 'enc:' + encryptText(newSessionString);
  }
  process.env.TELEGRAM_STRING_SESSION = sessionToSave;

  console.log('📡 Khởi tạo kết nối với Telegram Client mới...');
  return await getClient();
}

/**
 * Upload file lên Saved Messages của tài khoản Telegram.
 * @param {string} filePath - Đường dẫn tuyệt đối tới file tạm trên máy chủ.
 * @param {string} fileName - Tên file gốc của người dùng.
 * @param {string} mimeType - MIME type.
 * @param {string} caption - Caption / ghi chú đính kèm (tùy chọn).
 * @returns {{ messageId: number, fileId: string, fileSize: number }}
 */
export async function uploadFile(filePath, fileName, mimeType, caption = '', progressCallback = null) {
  const client = await getClient();
  const encFilePath = filePath + '.enc';

  try {
    // 1. Mã hóa tệp tin ra đĩa bằng luồng (Streaming)
    if (progressCallback) {
      progressCallback(0);
    }
    await encryptFileOnDisk(filePath, encFilePath);
    const fileSize = fs.statSync(encFilePath).size;

    // 2. Tạo CustomFile để GramJS tự đọc chunk từ đĩa
    const fileToUpload = new CustomFile(fileName, fileSize, encFilePath);

    // 3. Gửi file vào Saved Messages (chat 'me')
    const result = await client.sendFile('me', {
      file: fileToUpload,
      caption: caption || `📎 ${fileName}`,
      fileName: fileName,
      forceDocument: true, // Gửi dưới dạng tài liệu (document) thay vì ảnh/video
      workers: 2, // Giảm số lượng workers để tránh làm quá tải CPU/RAM trên Render Free (tránh OOM)
      progressCallback: (downloaded, fullSize) => {
        if (progressCallback && fullSize && fullSize.toJSNumber() > 0) {
          const percent = Math.round((downloaded.toJSNumber() / fullSize.toJSNumber()) * 100);
          progressCallback(percent);
        }
      }
    });

    // Trích xuất thông tin từ kết quả
    const messageId = result.id;

    // Lấy file_id qua thuộc tính media.document
    let fileId = '';
    let fileUniqueId = '';

    if (result.media && result.media.document) {
      const doc = result.media.document;
      fileId = `${doc.id}`;
      fileUniqueId = `${doc.accessHash}`;
    }

    return {
      messageId,
      fileId,
      fileUniqueId,
      fileSize,
    };
  } catch (error) {
    console.error('❌ Lỗi khi mã hóa/tải file lên Telegram:', error);
    throw error;
  } finally {
    // 4. Dọn dẹp file mã hóa tạm trên máy chủ
    try {
      if (fs.existsSync(encFilePath)) {
        fs.unlinkSync(encFilePath);
      }
    } catch (e) {
      console.error('Không thể xóa file mã hóa tạm:', e);
    }
  }
}

/**
 * Tải file về từ Telegram Saved Messages bằng message ID.
 * Trả về Buffer của file.
 * @param {number} messageId - ID tin nhắn chứa file trong Saved Messages.
 * @returns {Buffer}
 */
export async function downloadFile(messageId) {
  const client = await getClient();

  // Lấy tin nhắn theo ID từ Saved Messages
  const messages = await client.getMessages('me', { ids: [messageId] });

  if (!messages || messages.length === 0 || !messages[0]) {
    throw new Error('Không tìm thấy tin nhắn trong Saved Messages.');
  }

  const message = messages[0];

  if (!message.media) {
    throw new Error('Tin nhắn không chứa file đính kèm.');
  }

  // Tải nội dung file dưới dạng Buffer
  const buffer = await client.downloadMedia(message.media, {});

  // Giải mã file buffer
  try {
    const decrypted = decryptBuffer(buffer);
    console.log(`🔓 Giải mã thành công file từ tin nhắn #${messageId}.`);
    return decrypted;
  } catch (err) {
    console.warn(`⚠️ Giải mã file thất bại từ tin nhắn #${messageId}. Có thể file chưa được mã hóa. Trả về buffer gốc.`);
    return buffer;
  }
}

/**
 * Xóa tin nhắn (file) trong Saved Messages.
 * @param {number} messageId
 */
export async function deleteMessage(messageId) {
  const client = await getClient();
  await client.deleteMessages('me', [messageId], { revoke: true });
}

/**
 * Tải file từ Telegram Saved Messages và lưu trực tiếp xuống đĩa theo chunk, sau đó giải mã.
 * Giải pháp tối ưu hóa RAM (tránh OOM) cho file dung lượng lớn.
 * @param {number} messageId - ID tin nhắn chứa file.
 * @param {string} targetFilePath - Đường dẫn file đích (đã giải mã) trên đĩa.
 */
export async function downloadFileToDisk(messageId, targetFilePath) {
  const client = await getClient();
  const messages = await client.getMessages('me', { ids: [messageId] });

  if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
    throw new Error('Không tìm thấy file trên Telegram.');
  }

  const tempEncPath = targetFilePath + '.enc';
  const writeStream = fs.createWriteStream(tempEncPath);

  // 1. Tải tệp đã mã hóa về đĩa theo từng khối 2MB
  for await (const chunk of client.iterDownload({
    file: messages[0].media,
    requestSize: 2048 * 1024, // Tải từng khối 2MB
  })) {
    writeStream.write(chunk);
  }
  writeStream.end();

  // Đợi writeStream ghi xong hoàn toàn
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // 2. Giải mã tệp từ đĩa sang tệp đích bằng luồng (Streaming Decryption)
  try {
    await decryptFileOnDisk(tempEncPath, targetFilePath);
  } finally {
    // Dọn dẹp tệp mã hóa tạm
    try {
      if (fs.existsSync(tempEncPath)) {
        fs.unlinkSync(tempEncPath);
      }
    } catch (e) {
      console.error('Không thể xóa tệp mã hóa tạm sau giải mã:', e);
    }
  }
}
