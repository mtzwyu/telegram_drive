import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Shield, ArrowRight, FolderOpen, Send, Phone, QrCode, Cloud, HardDrive, Cpu, Hexagon } from 'lucide-react';

function Login({ onAuthSuccess, theme }) {
  const [activeTab, setActiveTab] = useState('qr'); // 'qr', 'phone'
  
  // State SĐT Login
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneStep, setPhoneStep] = useState(1); // 1: Nhập SĐT, 2: Nhập OTP
  const [loginSessionId, setLoginSessionId] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  
  // State QR Login
  const [qrUrl, setQrUrl] = useState('');
  const [qrExpires, setQrExpires] = useState(0);
  const [qrStatus, setQrStatus] = useState('idle'); // 'idle', 'connecting', 'active', 'requires_2fa', 'error', 'success'
  const [qrError, setQrError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);

  const [botUsername, setBotUsername] = useState('');
  const sseRef = useRef(null);
  const rememberMeRef = useRef(rememberMe);

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  // Lấy cấu hình công khai
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/config');
        if (res.data && res.data.botUsername) {
          setBotUsername(res.data.botUsername);
        }
      } catch (err) {
        console.error('Không thể lấy bot username:', err);
      }
    };
    fetchConfig();
  }, []);

  // Đếm ngược hạn dùng QR
  useEffect(() => {
    if (countdown > 0 && qrStatus === 'active') {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, qrStatus]);

  // Thiết lập SSE khi Tab QR hoạt động
  useEffect(() => {
    if (activeTab === 'qr') {
      startQrSse();
    } else {
      stopQrSse();
    }
    return () => stopQrSse();
  }, [activeTab]);

  const startQrSse = () => {
    stopQrSse();
    setQrStatus('connecting');
    setQrError('');
    setQrUrl('');

    const protocol = window.location.protocol;
    const host = window.location.host;
    const sseUrl = `${protocol}//${host}/api/auth/telegram/qr/stream`;

    console.log('🔗 Đang mở kết nối SSE QR...');
    const sse = new EventSource(sseUrl);
    sseRef.current = sse;

    sse.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Nhận sự kiện SSE:', data);

        if (data.type === 'qr') {
          setQrUrl(data.url);
          setQrStatus('active');
          const secondsLeft = Math.max(0, Math.floor((data.expires - Date.now() / 1000)));
          setCountdown(secondsLeft || 30);
        } else if (data.type === 'requires_2fa') {
          setQrStatus('requires_2fa');
          setQrError(data.message);
          stopQrSse();
        } else if (data.type === 'error') {
          setQrStatus('error');
          setQrError(data.message);
          stopQrSse();
        } else if (data.type === 'success') {
          setQrStatus('success');
          stopQrSse();
          
          try {
            const res = await axios.post('/api/auth/session', { token: data.token, rememberMe: rememberMeRef.current });
            if (res.data && res.data.success) {
              onAuthSuccess(res.data.user, res.data.token, rememberMeRef.current);
            }
          } catch (err) {
            setQrStatus('error');
            setQrError('Không thể hoàn tất tạo phiên đăng nhập.');
          }
        }
      } catch (err) {
        console.error('Lỗi phân tích dữ liệu SSE:', err);
      }
    };

    sse.onerror = (err) => {
      console.error('Lỗi kết nối SSE:', err);
      setQrStatus('error');
      setQrError('Mất kết nối với máy chủ QR.');
      stopQrSse();
    };
  };

  const stopQrSse = () => {
    if (sseRef.current) {
      console.log('🔌 Đóng kết nối SSE QR...');
      sseRef.current.close();
      sseRef.current = null;
    }
  };

  // Gửi OTP cho SĐT
  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setPhoneError('Vui lòng nhập số điện thoại.');
      return;
    }

    setPhoneSubmitting(true);
    setPhoneError('');

    try {
      const res = await axios.post('/api/auth/telegram/phone/send-code', {
        phoneNumber: phoneNumber.trim()
      });
      if (res.data && res.data.success) {
        setLoginSessionId(res.data.loginSessionId);
        setPhoneStep(2);
      }
    } catch (err) {
      setPhoneError(err.response?.data?.error || 'Gửi mã OTP thất bại. Hãy kiểm tra lại số điện thoại.');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // Đăng nhập bằng OTP / Mật khẩu
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (!phoneCode.trim()) {
      setPhoneError('Vui lòng nhập mã OTP.');
      return;
    }

    setPhoneSubmitting(true);
    setPhoneError('');

    try {
      const payload = {
        loginSessionId,
        phoneCode: phoneCode.trim(),
        rememberMe
      };
      if (requires2FA && password.trim()) {
        payload.password = password.trim();
      }

      const res = await axios.post('/api/auth/telegram/phone/login', payload);
      if (res.data && res.data.success) {
        if (res.data.requiresPassword) {
          setRequires2FA(true);
          setPhoneError('Tài khoản yêu cầu mật khẩu 2FA. Vui lòng nhập mật khẩu cấp 2.');
        } else {
          onAuthSuccess(res.data.user, res.data.token, rememberMe);
        }
      }
    } catch (err) {
      setPhoneError(err.response?.data?.error || 'Mã OTP hoặc mật khẩu 2FA không chính xác.');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-16 relative md:px-8 max-w-7xl mx-auto">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
        
        {/* ================= BÊN TRÁI: EDITORIAL BRAND HERO (CẢM HỨNG TELEGRAM DRIVE) ================= */}
        <div className="lg:col-span-7 space-y-10 text-left animate-fade-in delay-1">
          <div className="flex items-center gap-3">
            <Hexagon className="w-4 h-4 text-[var(--accent-color)] animate-spin" style={{ animationDuration: '10s' }} />
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase font-bold">
              telegram_drive_system
            </span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-6xl sm:text-8xl font-black title-font leading-none tracking-tight uppercase">
              <span className="text-[var(--accent-color)]">TELEGRAM</span><br />
              <span className="opacity-80 font-light italic">DRIVE.</span>
            </h1>
            
            <p className="text-xs leading-relaxed max-w-xl text-secondary text-justify font-sans">
              Telegram Drive là giải pháp lưu trữ dữ liệu đám mây cá nhân bảo mật và tiện lợi. 
              Hệ thống cho phép bạn lưu trữ tệp tin không giới hạn dung lượng trực tiếp trên hạ tầng đám mây của Telegram, 
              hỗ trợ tải lên, quản lý trực quan qua giao diện Web và chia sẻ nhanh chóng qua Telegram Bot.
            </p>
          </div>

          {/* Dòng Banner Charcoal mạ vàng cực kỳ sang trọng */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-2xl relative overflow-hidden group hover:border-[var(--accent-color)] transition-all duration-300">
            <div className="absolute inset-0 grain-overlay opacity-5 pointer-events-none"></div>
            
            {/* Logo Cloud mạ chrome */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[var(--accent-color)] flex items-center justify-center text-[var(--accent-color)] shrink-0 relative shadow-[0_0_15px_var(--shadow-glow)] group-hover:scale-105 transition-transform duration-300">
              <Cloud className="w-8 h-8" />
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--accent-color)] rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-[#0E0F11] rounded-full"></span>
              </div>
            </div>
            
            <div className="space-y-1.5 text-center sm:text-left flex-1 font-mono">
              <h4 className="text-[9px] font-bold text-[var(--accent-color)] uppercase tracking-widest">
                TELEGRAM CLOUD STORAGE
              </h4>
              <p className="text-sm font-bold tracking-wide text-[var(--text-primary)] font-display">
                Hệ thống lưu trữ đám mây cá nhân của bạn
              </p>
              <div className="flex justify-center sm:justify-start gap-4 pt-1.5 text-[9px] text-secondary">
                <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5 text-[var(--accent-color)]" /> UNLIMITED STORAGE</span>
                <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-[var(--accent-color)]" /> MTPROTO PROTOCOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= BÊN PHẢI: LOGIN PANEL (GLASSMORPHISM CARD) ================= */}
        <div className="lg:col-span-5 animate-fade-in delay-2">
          <div className="w-full glass-panel rounded-2xl p-6 sm:p-8 relative border border-[var(--border-color)]">
            
            {/* Header Form */}
            <div className="text-center mb-6 font-mono">
              <h2 className="text-sm font-extrabold title-font uppercase tracking-widest text-current">
                SECURE AUTH GATE
              </h2>
              <p className="text-[9px] text-secondary mt-1">
                SELECT LOGIN DECK CREDENTIALS
              </p>
            </div>

            {/* Tab Selection */}
            <div className="flex border-b border-[var(--border-color)] mb-6 bg-current/[0.02] rounded-full p-1">
              <button
                onClick={() => setActiveTab('qr')}
                className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-full flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${
                  activeTab === 'qr' 
                    ? 'bg-[var(--accent-color)] text-[#0E0F11] shadow-lg' 
                    : 'text-secondary hover:text-current'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> [ QR ]
              </button>
              <button
                onClick={() => setActiveTab('phone')}
                className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-full flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${
                  activeTab === 'phone' 
                    ? 'bg-[var(--accent-color)] text-[#0E0F11] shadow-lg' 
                    : 'text-secondary hover:text-current'
                }`}
              >
                <Phone className="w-3.5 h-3.5" /> [ Phone ]
              </button>
            </div>

            {/* -------------------- TAB 1: QR CODE -------------------- */}
            {activeTab === 'qr' && (
              <div className="text-center space-y-4">
                <h3 className="text-[9px] font-mono uppercase tracking-wider text-secondary">LINK DEVICE THROUGH QR CODE</h3>
                
                {/* Khung quét mã QR cao cấp viền vàng */}
                <div className="flex justify-center p-4 bg-white rounded-2xl w-48 h-48 sm:w-52 sm:h-52 mx-auto items-center relative border border-[var(--border-color)] shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                  {qrStatus === 'connecting' && (
                    <div className="text-black text-xs font-mono animate-pulse uppercase tracking-wider">CONNECTING...</div>
                  )}
                  {qrStatus === 'idle' && (
                    <div className="text-black text-xs font-mono uppercase tracking-wider">PREPARING...</div>
                  )}
                  {qrStatus === 'active' && qrUrl && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`}
                      alt="Telegram Login QR Code"
                      className="w-full h-full object-contain transition-all duration-300"
                    />
                  )}
                  {['error', 'requires_2fa'].includes(qrStatus) && (
                    <div className="text-red-600 text-xs font-mono uppercase tracking-widest font-bold">
                      {qrError || 'GENERATION FAIL'}
                    </div>
                  )}
                  {qrStatus === 'success' && (
                    <div className="text-emerald-600 text-xs font-mono uppercase tracking-widest font-bold animate-bounce">SUCCESS</div>
                  )}
                </div>

                {qrStatus === 'active' && (
                  <div className="text-[10px] font-mono text-secondary">
                    EXPIRES IN: <span className="font-bold text-[var(--accent-color)]">{countdown}s</span>
                  </div>
                )}

                {/* Hướng dẫn chi tiết */}
                <div className="text-[10px] text-secondary bg-current/[0.02] p-4 rounded-xl border border-gray-400/5 leading-relaxed text-left space-y-1.5 font-mono">
                  <p className="font-bold text-current/80 uppercase tracking-widest">INSTRUCTIONS:</p>
                  <p>1. Open <b>Telegram</b> app on your phone.</p>
                  <p>2. Go to <b>Settings</b> &rarr; <b>Devices</b> &rarr; <b>Link Desktop Device</b>.</p>
                  <p>3. Point camera at the QR code above.</p>
                </div>

                {['error', 'requires_2fa'].includes(qrStatus) && (
                  <button
                    onClick={startQrSse}
                    className="w-full py-2.5 border border-red-500/20 hover:border-red-500 text-red-500 hover:bg-red-500/5 rounded-full text-xs font-mono uppercase transition cursor-pointer font-bold"
                  >
                    Reset QR Connection
                  </button>
                )}
              </div>
            )}

            {/* -------------------- TAB 2: SỐ ĐIỆN THOẠI -------------------- */}
            {activeTab === 'phone' && (
              <div className="space-y-4">
                {phoneStep === 1 ? (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="phoneNumber" className="text-[9px] font-mono font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                        <Phone className="w-3 h-3 text-[var(--accent-color)]" /> Telegram Account Phone
                      </label>
                      <input
                        id="phoneNumber"
                        type="text"
                        placeholder="e.g. +84912345678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-current/5 border border-gray-400/10 focus:outline-none text-current text-xs placeholder:text-gray-600 focus:border-[var(--accent-color)]"
                      />
                      <p className="text-[9px] text-secondary font-mono italic">
                        * Must include country code (+84 for Vietnam).
                      </p>
                    </div>

                    {phoneError && (
                      <p className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg font-mono">
                        ERR: {phoneError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={phoneSubmitting}
                      className="w-full btn-3d-tilt text-xs font-bold"
                    >
                      {phoneSubmitting ? (
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <span>SEND CODE</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="phoneCode" className="text-[9px] font-mono font-bold text-secondary uppercase tracking-widest">
                        Enter OTP Code
                      </label>
                      <input
                        id="phoneCode"
                        type="text"
                        placeholder="OTP..."
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-current/5 border border-gray-400/10 focus:outline-none text-current text-xs placeholder:text-gray-600 focus:border-[var(--accent-color)]"
                      />
                    </div>

                    {requires2FA && (
                      <div className="space-y-2">
                        <label htmlFor="password2fa" className="text-[9px] font-mono font-bold text-secondary uppercase tracking-widest">
                          Account 2FA Password
                        </label>
                        <input
                          id="password2fa"
                          type="password"
                          placeholder="Password..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-current/5 border border-gray-400/10 focus:outline-none text-current text-xs text-center tracking-widest placeholder:text-gray-600 focus:border-[var(--accent-color)]"
                        />
                      </div>
                    )}

                    {phoneError && (
                      <p className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg font-mono">
                        ERR: {phoneError}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneStep(1);
                          setRequires2FA(false);
                          setPhoneError('');
                        }}
                        className="flex-1 py-3 rounded-full border border-gray-400/10 hover:bg-current/5 text-[10px] text-current font-mono uppercase cursor-pointer transition font-bold"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={phoneSubmitting}
                        className="flex-[2] btn-3d-tilt text-xs font-bold"
                      >
                        {phoneSubmitting ? (
                          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <span>LOG IN</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Duy trì đăng nhập */}
            <div className="mt-6 flex items-center justify-between border-t border-[var(--border-color)] pt-4 font-mono text-[10px]">
              <label className="flex items-center gap-2 cursor-pointer text-secondary hover:text-current select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-zinc-800 text-[var(--accent-color)] focus:ring-0 cursor-pointer accent-[var(--accent-color)]"
                />
                <span>Duy trì đăng nhập (30 ngày)</span>
              </label>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
