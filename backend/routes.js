import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { computeCheck } from 'telegram/Password.js';
import { dbService } from './db.js';
import { categorizeFile, encryptText, decryptText, encryptBuffer, decryptBuffer, updateEnvFile } from './utils.js';
import { uploadFile, downloadFile, deleteMessage, updateSessionAndReconnect } from './telegramClient.js';

// Load biến môi trường từ file .env
dotenv.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').map(id => id.trim());
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Cấu hình Multer để lưu tạm file khi upload từ web
const tempDir = process.env.TEMP_UPLOAD_DIR || path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Giữ nguyên tên file gốc tránh lỗi mã hóa ký tự
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

/**
 * Middleware xác thực JWT Session từ Cookie.
 */
export function authenticateToken(req, res, next) {
  const token = req.cookies?.session_token;
  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.clearCookie('session_token');
      return res.status(403).json({ error: 'Session hết hạn hoặc không hợp lệ' });
    }
    req.user = user;
    next();
  });
}

/**
 * Hàm kiểm tra tính hợp lệ của Telegram initData.
 */
function verifyTelegramInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    // Lọc bỏ hash và sắp xếp các tham số
    const keys = Array.from(params.keys()).filter(key => key !== 'hash').sort();
    const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

    // Tạo khóa bí mật từ Bot Token
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    
    // Tạo hash kiểm tra
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return false;

    // Parse thông tin user để kiểm tra quyền Admin
    const userJson = params.get('user');
    if (!userJson) return false;

    const user = JSON.parse(userJson);
    return {
      userId: user.id.toString(),
      username: user.username || '',
      firstName: user.first_name || ''
    };
  } catch (e) {
    console.error('Lỗi khi xác thực initData:', e);
    return false;
  }
}

// Cấu hình quản lý session login bằng SĐT Telegram
const activeLoginSessions = new Map();
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

function setSessionTimeout(sessionId, timeoutMs = 10 * 60 * 1000) {
  setTimeout(() => {
    const session = activeLoginSessions.get(sessionId);
    if (session) {
      console.log(`🧹 Dọn dẹp phiên login tạm thời: ${sessionId}`);
      if (session.client) {
        session.client.disconnect().catch(() => {});
      }
      activeLoginSessions.delete(sessionId);
    }
  }, timeoutMs);
}



/**
 * API: Đăng nhập bằng Telegram (Hỗ trợ Mini App initData, Bot Login Link và Login Widget).
 */
router.post('/auth/telegram', (req, res) => {
  const { initData, token, widgetData } = req.body;

  // Trường hợp 1: Đăng nhập bên trong Telegram Mini App qua initData
  if (initData) {
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser) {
      return res.status(400).json({ error: 'Dữ liệu xác thực Telegram không hợp lệ' });
    }

    if (!ALLOWED_USER_IDS.includes(telegramUser.userId)) {
      return res.status(403).json({ error: 'Tài khoản của bạn không được cấp quyền truy cập' });
    }

    // Đăng nhập thành công, tạo JWT Session
    const sessionToken = jwt.sign({ userId: telegramUser.userId, username: telegramUser.username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    return res.json({ success: true, user: telegramUser });
  }

  return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
});

/**
 * API: Gửi mã xác thực OTP về số điện thoại Telegram
 */
router.post('/auth/telegram/phone/send-code', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Thiếu số điện thoại' });
  }

  try {
    const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
      connectionRetries: 5,
    });
    await client.connect();

    const sendCodeResult = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );

    const loginSessionId = crypto.randomUUID();
    activeLoginSessions.set(loginSessionId, {
      client,
      phoneCodeHash: sendCodeResult.phoneCodeHash,
      phoneNumber
    });

    setSessionTimeout(loginSessionId);

    res.json({
      success: true,
      loginSessionId,
      phoneCodeHash: sendCodeResult.phoneCodeHash
    });
  } catch (error) {
    console.error('Lỗi sendCode:', error);
    res.status(500).json({ error: error.message || 'Lỗi gửi mã xác thực' });
  }
});

/**
 * API: Đăng nhập bằng số điện thoại và mã OTP (có hỗ trợ 2FA)
 */
router.post('/auth/telegram/phone/login', async (req, res) => {
  const { loginSessionId, phoneCode, password } = req.body;
  if (!loginSessionId || !phoneCode) {
    return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
  }

  const session = activeLoginSessions.get(loginSessionId);
  if (!session) {
    return res.status(400).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' });
  }

  const { client, phoneCodeHash, phoneNumber } = session;

  try {
    let user;
    try {
      const signInResult = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode,
        })
      );
      if (signInResult instanceof Api.auth.AuthorizationSignUpRequired) {
        return res.status(400).json({ error: 'Tài khoản chưa đăng ký Telegram' });
      }
      user = signInResult.user;
    } catch (err) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          // Báo cho frontend cần nhập mật khẩu 2FA
          return res.json({ requiresPassword: true, loginSessionId });
        }
        
        // Tiến hành check password 2FA
        const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
        const passwordSrpCheck = await computeCheck(passwordSrpResult, password);
        const passwordResult = await client.invoke(
          new Api.auth.CheckPassword({
            password: passwordSrpCheck,
          })
        );
        user = passwordResult.user;
      } else {
        throw err;
      }
    }

    if (!user) {
      return res.status(500).json({ error: 'Đăng nhập không thành công' });
    }

    const userId = user.id.toString();
    // Kiểm tra và cập nhật ALLOWED_USER_IDS nếu cần thiết
    if (!ALLOWED_USER_IDS.includes(userId)) {
      if (ALLOWED_USER_IDS.length === 0 || (ALLOWED_USER_IDS.length === 1 && ALLOWED_USER_IDS[0] === '')) {
        ALLOWED_USER_IDS.push(userId);
        updateEnvFile('ALLOWED_USER_IDS', userId);
      } else {
        await client.disconnect();
        activeLoginSessions.delete(loginSessionId);
        return res.status(403).json({ error: `Tài khoản Telegram ID ${userId} không được phép truy cập.` });
      }
    }

    const sessionString = client.session.save();
    const encryptedSession = 'enc:' + encryptText(sessionString);

    // Ghi vào file .env
    updateEnvFile('TELEGRAM_STRING_SESSION', encryptedSession);

    // Reconnect client chính
    await updateSessionAndReconnect(sessionString);

    // Đăng nhập thành công, tạo JWT Session
    const username = user.username || user.firstName || 'TelegramUser';
    const sessionToken = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Dọn dẹp session tạm
    activeLoginSessions.delete(loginSessionId);

    return res.json({
      success: true,
      user: {
        userId,
        username
      }
    });
  } catch (error) {
    console.error('Lỗi khi đăng nhập bằng SĐT:', error);
    res.status(500).json({ error: error.message || 'Mã OTP hoặc Mật khẩu không chính xác' });
  }
});

/**
 * API: Đồng bộ đăng nhập bằng QR Code (Server-Sent Events)
 */
router.get('/auth/telegram/qr/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  let isClosed = false;

  req.on('close', async () => {
    isClosed = true;
    console.log('🔌 Kết nối SSE QR Code đã đóng bởi client.');
    try {
      await client.disconnect();
    } catch (_) {}
  });

  try {
    await client.connect();

    const user = await client.signInUserWithQrCode(
      { apiId: API_ID, apiHash: API_HASH },
      {
        qrCode: async (code) => {
          if (isClosed) return;
          const base64Token = code.token.toString('base64url');
          const qrUrl = `tg://login?token=${base64Token}`;
          res.write(`data: ${JSON.stringify({ type: 'qr', url: qrUrl, expires: code.expires })}\n\n`);
        },
        password: async (hint) => {
          if (isClosed) return '';
          res.write(`data: ${JSON.stringify({ type: 'requires_2fa', message: 'Tài khoản đã kích hoạt 2FA. Vui lòng đăng nhập bằng Số điện thoại.' })}\n\n`);
          throw new Error('2FA_REQUIRED_USE_PHONE');
        },
        onError: async (err) => {
          if (isClosed) return true;
          res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
          return true;
        }
      }
    );

    if (user && !isClosed) {
      const userId = user.id.toString();

      if (!ALLOWED_USER_IDS.includes(userId)) {
        if (ALLOWED_USER_IDS.length === 0 || (ALLOWED_USER_IDS.length === 1 && ALLOWED_USER_IDS[0] === '')) {
          ALLOWED_USER_IDS.push(userId);
          updateEnvFile('ALLOWED_USER_IDS', userId);
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', message: `Telegram ID ${userId} không được phép truy cập.` })}\n\n`);
          res.end();
          await client.disconnect();
          return;
        }
      }

      const sessionString = client.session.save();
      const encryptedSession = 'enc:' + encryptText(sessionString);

      // Ghi vào file .env
      updateEnvFile('TELEGRAM_STRING_SESSION', encryptedSession);

      // Reconnect client chính
      await updateSessionAndReconnect(sessionString);

      const username = user.username || user.firstName || 'TelegramUser';
      const sessionToken = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });

      res.write(`data: ${JSON.stringify({ type: 'success', token: sessionToken, user: { userId, username } })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!isClosed) {
      console.error('Lỗi QR Login stream:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Lỗi đăng nhập bằng QR Code' })}\n\n`);
      res.end();
    }
  }
});

/**
 * API: Nhận JWT token từ QR success và thiết lập cookie session
 */
router.post('/auth/session', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Thiếu token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    return res.json({ success: true, user: { userId: decoded.userId, username: decoded.username } });
  } catch (e) {
    return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
});

/**
 * API: Đăng xuất.
 */
router.post('/auth/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true });
});

/**
 * API: Lấy thông tin cấu hình công khai (như botUsername để vẽ Widget).
 */
router.get('/config', (req, res) => {
  res.json({
    botUsername: req.bot?.botInfo?.username || ''
  });
});

/**
 * API: Lấy thông tin user hiện tại.
 */
router.get('/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

/**
 * API: Xem danh sách và tìm kiếm file.
 */
router.get('/files', authenticateToken, async (req, res) => {
  const { query, category, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const result = await dbService.getFiles({
      query,
      category,
      limit: parseInt(limit),
      offset
    });
    res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách file:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi truy vấn database' });
  }
});

/**
 * API: Tải file lên từ Web — gửi vào Saved Messages qua Telegram User API (MTProto).
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn file để tải lên' });
  }

  const tags = req.body.tags || '';
  const tempFilePath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype || 'application/octet-stream';

  try {
    // 1. Upload file lên Saved Messages qua MTProto
    const tgResult = await uploadFile(tempFilePath, originalName, mimeType, tags ? `#${tags.split(',').join(' #')}` : '');

    // 2. Phân loại định dạng file
    const category = categorizeFile(mimeType, originalName);
    const uuid = crypto.randomUUID();

    // 3. Lưu vào cơ sở dữ liệu
    const savedFile = await dbService.insertFile({
      uuid,
      fileId: tgResult.fileId,
      fileUniqueId: tgResult.fileUniqueId,
      messageId: tgResult.messageId,
      fileName: originalName,
      fileSize: tgResult.fileSize,
      mimeType,
      category,
      tags
    });

    res.json({ success: true, file: savedFile });
  } catch (error) {
    console.error('Lỗi khi upload file:', error.message);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi upload' });
  } finally {
    // 4. Dọn dẹp file tạm trên máy chủ
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.error('Không thể xóa file tạm:', e);
    }
  }
});

/**
 * API: Tải file về máy người dùng (Proxy từ Telegram Saved Messages qua MTProto).
 */
router.get('/download/:uuid', authenticateToken, async (req, res) => {
  const { uuid } = req.params;

  try {
    const file = await dbService.getFileByUuid(uuid);
    if (!file) {
      return res.status(404).json({ error: 'Không tìm thấy file trong hệ thống' });
    }

    // Tải file từ Saved Messages qua MTProto
    const buffer = await downloadFile(parseInt(file.message_id));

    // Thiết lập header phản hồi
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);

    res.send(buffer);
  } catch (error) {
    console.error('Lỗi khi tải file proxy:', error.message);
    res.status(500).json({ error: 'Lỗi khi kết nối tới Telegram để tải file' });
  }
});

/**
 * API: Xóa file.
 */
router.delete('/files/:uuid', authenticateToken, async (req, res) => {
  const { uuid } = req.params;

  try {
    const file = await dbService.getFileByUuid(uuid);
    if (!file) {
      return res.status(404).json({ error: 'Không tìm thấy file' });
    }

    // 1. Xóa tin nhắn chứa file trong Saved Messages qua MTProto
    try {
      await deleteMessage(parseInt(file.message_id));
    } catch (e) {
      console.warn('Cảnh báo: Không thể xóa tin nhắn chứa file trên Telegram.', e.message);
    }

    // 2. Xóa khỏi database
    const deleted = await dbService.deleteFile(uuid);
    if (deleted) {
      res.json({ success: true, message: 'Đã xóa file thành công' });
    } else {
      res.status(500).json({ error: 'Không thể xóa file khỏi database' });
    }
  } catch (error) {
    console.error('Lỗi khi xóa file:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi xóa file' });
  }
});

/**
 * API: Thống kê dung lượng, số lượng.
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await dbService.getStats();
    stats.botUsername = req.bot?.botInfo?.username || '';
    res.json(stats);
  } catch (error) {
    console.error('Lỗi khi tính thống kê:', error);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * API: Cập nhật thẻ tags cho file.
 */
router.post('/files/:uuid/tags', authenticateToken, async (req, res) => {
  const { uuid } = req.params;
  const { tags } = req.body;
  try {
    const updated = await dbService.updateTags(uuid, tags);
    if (updated) {
      res.json({ success: true, tags });
    } else {
      res.status(404).json({ error: 'Không tìm thấy file để cập nhật nhãn' });
    }
  } catch (error) {
    console.error('Lỗi cập nhật tags:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật nhãn' });
  }
});

/**
 * API: Tải file công khai không cần đăng nhập (Public Download Proxy qua MTProto).
 */
router.get('/share/:uuid', async (req, res) => {
  const { uuid } = req.params;

  try {
    const file = await dbService.getFileByUuid(uuid);
    if (!file) {
      return res.status(404).send('Không tìm thấy file chia sẻ này.');
    }

    // Tải file từ Saved Messages qua MTProto
    const buffer = await downloadFile(parseInt(file.message_id));

    // Thiết lập header phản hồi
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);

    res.send(buffer);
  } catch (error) {
    console.error('Lỗi khi tải file proxy công khai:', error.message);
    res.status(500).send('Lỗi khi kết nối tới Telegram để tải file công khai.');
  }
});

export default router;
