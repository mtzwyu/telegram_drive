import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, X, CheckCircle, AlertCircle, Tag, Paperclip } from 'lucide-react';

function UploadZone({ onUploadSuccess, onAllComplete, theme }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
      setStatus('idle');
      setProgress(0);
      setUploadIndex(0);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setStatus('idle');
      setProgress(0);
      setUploadIndex(0);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const clearFiles = () => {
    setFiles([]);
    setTagsInput('');
    setProgress(0);
    setUploadIndex(0);
    setStatus('idle');
    setErrorMessage('');
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setStatus('uploading');
    setProgress(0);
    setErrorMessage('');

    for (let i = 0; i < files.length; i++) {
      setUploadIndex(i);
      setProgress(0);
      const currentFile = files[i];

      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('tags', tagsInput.trim());

      try {
        const response = await axios.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        });

        if (response.data && response.data.success) {
          onUploadSuccess(response.data.file);
        }
      } catch (error) {
        setStatus('error');
        const errData = error.response?.data?.error;
        const errString = typeof errData === 'object' ? (errData.message || JSON.stringify(errData)) : errData;
        setErrorMessage(errString || error.message || `Lỗi tải lên tệp tin: "${currentFile.name}"`);
        return; // Dừng tiến trình tải lên nếu có lỗi xảy ra
      }
    }

    setStatus('success');
    setTimeout(() => {
      clearFiles();
      if (onAllComplete) {
        onAllComplete();
      }
    }, 1200);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group/upload">
      {/* Background radial glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-[var(--accent-color)]/5 rounded-full filter blur-xl group-hover/upload:bg-[var(--accent-color)]/10 transition-all duration-500"></div>

      <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--accent-color)] mb-5 flex items-center gap-2 font-bold">
        <Paperclip className="w-3.5 h-3.5 animate-pulse" /> TẢI LÊN MÁY CHỦ BỘ ĐỆM
      </h3>

      {status !== 'uploading' && status !== 'success' && status !== 'error' ? (
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleButtonClick}
            className={`border rounded-xl p-6 text-center cursor-pointer transition-all duration-500 relative overflow-hidden ${
              isDragActive 
                ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/[0.04] scale-[0.98] shadow-[0_0_20px_var(--shadow-glow)]' 
                : 'border-gray-400/10 bg-zinc-900/10 hover:border-[var(--accent-color)]/30 hover:bg-zinc-900/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleChange}
              className="hidden"
              multiple
            />
            
            {files.length > 0 ? (
              <div className="space-y-3 relative z-10 text-left">
                <div className="relative mx-auto w-12 h-12">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full filter blur-md transform scale-150 animate-pulse"></div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 relative z-10 shadow-[0_0_15px_rgba(16,185,129,0.15)] mx-auto">
                    <CheckCircle className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5 border border-gray-400/5 bg-black/20 rounded-xl p-3.5 max-h-[140px] overflow-y-auto">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--accent-color)] border-b border-gray-400/10 pb-1.5 mb-1.5">
                    DANH SÁCH FILE ĐÃ CHỌN ({files.length})
                  </p>
                  {files.map((f, i) => (
                    <div key={i} className="flex justify-between items-center gap-4 text-[10px] font-mono text-current border-b border-gray-400/5 last:border-0 pb-1 last:pb-0">
                      <span className="truncate flex-1 font-semibold">{f.name}</span>
                      <span className="text-secondary shrink-0">{formatFileSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative mx-auto w-12 h-12">
                  {/* Glowing gold back shadow on hover */}
                  <div className="absolute inset-0 bg-[var(--accent-color)]/10 rounded-full filter blur-md transform scale-150 opacity-0 group-hover/upload:opacity-100 transition-opacity duration-500"></div>
                  <div className="w-12 h-12 rounded-full bg-current/5 border border-gray-400/5 flex items-center justify-center text-secondary group-hover/upload:text-[var(--accent-color)] group-hover/upload:border-[var(--accent-color)]/20 transition-all duration-300 relative z-10">
                    <Upload className="w-5 h-5 group-hover/upload:-translate-y-0.5 transition-transform duration-300" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-current font-sans">
                    Kéo thả tệp hoặc <span className="text-[var(--accent-color)] hover:underline decoration-1">chọn từ máy</span>
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-mono leading-normal max-w-xs mx-auto opacity-60">
                    Hỗ trợ tệp tin nén, hình ảnh, video tối đa 2GB (chọn được nhiều file)
                  </p>
                </div>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-4 animate-fade-in text-left">
              {/* Tags Input widget */}
              <div className="space-y-1.5 font-mono">
                <label className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-[var(--accent-color)]" /> Nhãn phân loại (tags)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: tailieu, excel, code..."
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/20 border border-gray-400/10 focus:outline-none text-current text-xs focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)]/20 placeholder:text-gray-600 transition-all"
                />
              </div>

              {/* Action button triggers */}
              <div className="flex gap-3 items-center">
                <button
                  onClick={clearFiles}
                  className="flex-1 py-2.5 rounded-full border border-gray-400/10 text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Hủy bỏ
                </button>
                <button
                  onClick={uploadFiles}
                  className="flex-1 btn-3d-tilt text-[10px] uppercase font-mono tracking-widest py-2.5"
                >
                  Tải Lên Ngay
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Progress / Success / Error widgets
        <div className="py-6 space-y-6 text-center animate-fade-in">
          {status === 'uploading' && (
            <div className="space-y-4 text-left">
              <div className="relative w-10 h-10 mx-auto">
                <div className="absolute inset-0 border-2 border-current/10 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-t-[var(--accent-color)] rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1 font-mono">
                <p className="text-[9px] font-bold text-[var(--accent-color)] uppercase tracking-wider">
                  ĐANG TẢI LÊN: {uploadIndex + 1} / {files.length} TỆP TIN
                </p>
                <p className="text-xs font-bold truncate max-w-xs text-current uppercase">
                  {files[uploadIndex]?.name}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)]">TRANSMISSION RATIO: {progress}%</p>
              </div>
              
              {/* Premium minimal progress bar */}
              <div className="w-full h-1.5 bg-current/5 rounded-full overflow-hidden border border-[var(--border-color)]">
                <div 
                  className="h-full bg-[var(--accent-color)] shadow-[0_0_10px_var(--shadow-glow)]" 
                  style={{ width: `${progress}%`, transition: 'width 0.1s ease' }}
                ></div>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3 py-2 text-[var(--accent-color)] font-mono">
              <CheckCircle className="w-10 h-10 mx-auto animate-bounce text-emerald-500" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-500">UPLOAD COMPLETE</p>
              <p className="text-[9px] text-[var(--text-secondary)]">Tất cả tệp đã được lưu vĩnh viễn trên Telegram.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 py-2">
              <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-red-500">TRANSMISSION FAIL</p>
              <p className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 p-3 rounded-xl max-w-xs mx-auto font-mono">
                {errorMessage}
              </p>
              <button
                onClick={clearFiles}
                className="px-6 py-2.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-current/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadZone;
