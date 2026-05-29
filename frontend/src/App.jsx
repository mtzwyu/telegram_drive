import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import { Sun, Moon } from 'lucide-react';

// Cấu hình axios gửi kèm credentials (cookies)
axios.defaults.withCredentials = true;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  
  // Trạng thái Theme Sáng/Tối
  const [theme, setTheme] = useState('dark');

  // Hàm tự động xác định Sáng/Tối theo giờ Việt Nam (GMT+7)
  const getVietnamTimeTheme = () => {
    try {
      const options = { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const vietnamHour = parseInt(formatter.format(new Date()), 10);
      
      // Sáng từ 6h đến 18h
      const isDayTime = vietnamHour >= 6 && vietnamHour < 18;
      return isDayTime ? 'light' : 'dark';
    } catch (e) {
      const utcHour = new Date().getUTCHours();
      const vnHour = (utcHour + 7) % 24;
      return (vnHour >= 6 && vnHour < 18) ? 'light' : 'dark';
    }
  };

  useEffect(() => {
    // 1. Quản lý Theme ban đầu
    const savedTheme = localStorage.getItem('user-theme');
    const initialTheme = savedTheme ? savedTheme : getVietnamTimeTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    // 2. Kiểm tra môi trường Telegram Mini App (TWA)
    const tg = window.Telegram?.WebApp;
    
    if (tg && tg.initData) {
      setIsTelegramMiniApp(true);
      document.body.classList.add('twa');
      tg.ready();
      tg.expand();
      
      authenticateWithTelegramMiniApp(tg.initData);
    } else {
      // 3. Kiểm tra Session cũ trong Cookie qua API /api/auth/me
      checkExistingSession();
    }
  }, []);

  const applyTheme = (newTheme) => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem('user-theme', nextTheme);
  };

  const checkExistingSession = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data && res.data.user) {
        setIsAuthenticated(true);
        setUser(res.data.user);
      }
    } catch (err) {
      console.log('Session không tồn tại hoặc hết hạn.');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateWithTelegramMiniApp = async (initData) => {
    try {
      const res = await axios.post('/api/auth/telegram', { initData });
      if (res.data && res.data.success) {
        setIsAuthenticated(true);
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Xác thực Telegram Mini App thất bại:', err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  };



  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await axios.post('/api/auth/logout');
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error('Không thể đăng xuất:', err);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-amber-400/20 selection:text-current">
      {/* Kẻ lưới kiến trúc đồ họa Telegram Drive */}
      <div className="editorial-grid-bg"></div>

      {/* Background blobs phát sáng (Warm Glow) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] mesh-blob-1 rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] mesh-blob-2 rounded-full pointer-events-none"></div>
      
      {/* Lớp hạt cát mịn phủ toàn trang */}
      <div className="absolute inset-0 grain-overlay z-10"></div>

      {/* Nút chuyển đổi Theme mạ vàng góc phải */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="w-11 h-11 rounded-full border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:bg-current/5 transition-all duration-400 shadow-lg backdrop-blur-md cursor-pointer flex items-center justify-center text-[var(--accent-color)]"
          title={theme === 'dark' ? 'Chuyển sang chế độ Sáng (Giờ VN)' : 'Chuyển sang chế độ Tối (Giờ VN)'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-800" />}
        </button>
      </div>

      <div className="relative z-20 min-h-screen">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen text-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-2 border-[var(--border-color)] rounded-full"></div>
              <div className="absolute inset-0 border-2 border-t-[var(--accent-color)] rounded-full animate-spin"></div>
            </div>
            <h2 className="mt-8 text-[10px] font-mono tracking-[0.3em] uppercase animate-pulse text-[var(--accent-color)]">
              LOADING SYSTEM NODE...
            </h2>
          </div>
        ) : isAuthenticated ? (
          <Dashboard user={user} handleLogout={handleLogoutClick} isTWA={isTelegramMiniApp} theme={theme} />
        ) : (
          <Login onAuthSuccess={(user) => {
            setIsAuthenticated(true);
            setUser(user);
          }} theme={theme} />
        )}
      </div>

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-6 border border-[var(--border-color)] text-center relative z-50">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center justify-center gap-2 font-bold">
              <Sun className="w-3.5 h-3.5 text-[var(--accent-color)] animate-pulse" /> YÊU CẦU XÁC THỰC
            </h3>
            
            <h4 className="text-sm font-bold uppercase tracking-wide text-current mb-6 font-display leading-relaxed">
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?
            </h4>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-current hover:bg-current/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 btn-3d-tilt text-[10px] uppercase font-mono tracking-widest py-2.5"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
