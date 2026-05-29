import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Folder, FileText, Image as ImageIcon, Video as VideoIcon, Music, Archive, File, 
  Search, Download, Copy, Share2, Send, Trash2, LogOut, RefreshCw, FolderOpen, 
  Tag, Calendar, Database, X, Edit2, Play, Eye, ChevronRight, Hexagon, Cloud,
  Facebook, Mail, Github, Phone, Plus, Check
} from 'lucide-react';
import UploadZone from './UploadZone.jsx';

function Dashboard({ user, handleLogout, isTWA, theme }) {
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedState, setCopiedState] = useState({ uuid: '', type: '' }); // type: 'web' or 'tg'
  const [deletingUuid, setDeletingUuid] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [selectedUuids, setSelectedUuids] = useState([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0, isDeleting: false });

  // Reset selection on category change or search query change
  useEffect(() => {
    setSelectedUuids([]);
  }, [activeCategory, searchQuery]);

  const toggleSelectFile = (uuid) => {
    setSelectedUuids(prev => 
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  };

  const clearSelection = () => {
    setSelectedUuids([]);
  };

  const selectAllFiles = () => {
    const allUuids = files.map(f => f.uuid);
    const areAllSelected = allUuids.every(uuid => selectedUuids.includes(uuid));
    if (areAllSelected) {
      setSelectedUuids(prev => prev.filter(uuid => !allUuids.includes(uuid)));
    } else {
      setSelectedUuids(prev => {
        const unique = new Set([...prev, ...allUuids]);
        return Array.from(unique);
      });
    }
  };

  const executeBulkDelete = async () => {
    if (selectedUuids.length === 0) return;
    const uuidsToDelete = [...selectedUuids];
    setIsBulkDeleteConfirmOpen(false);
    setBulkDeleteProgress({ current: 0, total: uuidsToDelete.length, isDeleting: true });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uuidsToDelete.length; i++) {
      const uuid = uuidsToDelete[i];
      try {
        const res = await axios.delete(`/api/files/${uuid}`);
        if (res.data && res.data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Error deleting file ${uuid}:`, err);
        failCount++;
      }
      setBulkDeleteProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setFiles(prev => prev.filter(f => !uuidsToDelete.includes(f.uuid)));
    setTotalFiles(prev => Math.max(0, prev - successCount));
    fetchStats();
    setSelectedUuids([]);
    setBulkDeleteProgress({ current: 0, total: 0, isDeleting: false });

    if (failCount === 0) {
      showToast(`Đã xóa thành công ${successCount} tệp tin`, 'success');
    } else {
      showToast(`Đã xóa ${successCount} tệp tin (${failCount} tệp lỗi)`, 'error');
    }
  };


  // States hỗ trợ chức năng nâng cao (Preview & Edit Tags)
  const [previewFile, setPreviewFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [tempTags, setTempTags] = useState('');

  // Custom Confirmation & Notification states
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [toast, setToast] = useState({ message: '', type: '' });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const categories = [
    { id: 'all', label: 'TẤT CẢ FILE', subtitle: 'Tổng thư mục lưu trữ', icon: Folder, coverBg: 'linear-gradient(135deg, rgba(197, 168, 128, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%)' },
    { id: 'document', label: 'TÀI LIỆU', subtitle: 'Báo cáo, PDF, văn bản', icon: FileText, coverBg: 'linear-gradient(135deg, rgba(30, 78, 82, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' },
    { id: 'image', label: 'HÌNH ẢNH', subtitle: 'Artwork, ảnh chụp chất lượng', icon: ImageIcon, coverBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' },
    { id: 'video', label: 'VIDEO', subtitle: 'Clips, video truyền thông', icon: VideoIcon, coverBg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' },
    { id: 'audio', label: 'ÂM THANH', subtitle: 'Nhạc, thu âm, soundscapes', icon: Music, coverBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' },
    { id: 'archive', label: 'FILE NÉN', subtitle: 'Zip, rar, developer packages', icon: Archive, coverBg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)' }
  ];

  // Khởi chạy dữ liệu
  useEffect(() => {
    fetchStats();
    fetchFiles(1, activeCategory, searchQuery, false);
  }, [activeCategory]);

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchFiles(1, activeCategory, searchQuery, false);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Không thể lấy thống kê:', err);
    }
  };

  const fetchFiles = async (pageNum, cat, search, loadMore = false) => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/files', {
        params: {
          page: pageNum,
          category: cat,
          query: search,
          limit: 10
        }
      });

      if (res.data) {
        if (loadMore) {
          setFiles(prev => [...prev, ...res.data.files]);
        } else {
          setFiles(res.data.files);
        }
        setTotalFiles(res.data.total);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFiles(nextPage, activeCategory, searchQuery, true);
  };

  const handleUploadSuccess = (newFile) => {
    setFiles(prev => [newFile, ...prev]);
    setTotalFiles(prev => prev + 1);
    fetchStats();
  };

  const executeDeleteFile = async () => {
    if (!deleteConfirmFile) return;
    const uuid = deleteConfirmFile.uuid;
    const fileName = deleteConfirmFile.file_name;
    setDeletingUuid(uuid);
    setDeleteConfirmFile(null);
    try {
      const res = await axios.delete(`/api/files/${uuid}`);
      if (res.data && res.data.success) {
        setFiles(prev => prev.filter(f => f.uuid !== uuid));
        setSelectedUuids(prev => prev.filter(id => id !== uuid));
        setTotalFiles(prev => prev - 1);
        fetchStats();
        if (previewFile?.uuid === uuid) setPreviewFile(null);
        showToast(`Đã xóa file "${fileName}" thành công`, 'success');
      }
    } catch (err) {
      showToast('Lỗi khi xóa file: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setDeletingUuid('');
    }
  };

  const handleCopyWebLink = (uuid) => {
    const shareUrl = `${window.location.origin}/share/${uuid}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopiedState({ uuid, type: 'web' });
        showToast('Đã sao chép link Web thành công', 'success');
        setTimeout(() => setCopiedState({ uuid: '', type: '' }), 2000);
      })
      .catch(err => {
        console.error('Lỗi copy link web:', err);
        showToast('Lỗi sao chép link Web', 'error');
      });
  };

  const handleCopyTelegramLink = (uuid) => {
    const botUser = stats?.botUsername || 'your_bot';
    const shareUrl = `https://t.me/${botUser}?start=${uuid}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopiedState({ uuid, type: 'tg' });
        showToast('Đã sao chép link Bot Telegram thành công', 'success');
        setTimeout(() => setCopiedState({ uuid: '', type: '' }), 2000);
      })
      .catch(err => {
        console.error('Lỗi copy link bot:', err);
        showToast('Lỗi sao chép link Bot', 'error');
      });
  };

  const startEditTags = (file) => {
    setEditingFile(file);
    setTempTags(file.tags || '');
  };

  const handleSaveTags = async () => {
    if (!editingFile) return;
    try {
      const res = await axios.post(`/api/files/${editingFile.uuid}/tags`, { tags: tempTags });
      if (res.data && res.data.success) {
        setFiles(prev => prev.map(f => f.uuid === editingFile.uuid ? { ...f, tags: tempTags } : f));
        setEditingFile(null);
        fetchStats();
        showToast('Cập nhật nhãn phân loại thành công', 'success');
      }
    } catch (err) {
      showToast('Lỗi cập nhật thẻ nhãn: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryIcon = (category) => {
    const cat = categories.find(c => c.id === category);
    const IconComp = cat ? cat.icon : File;
    return <IconComp className="w-4 h-4 text-black" />;
  };

  const isPreviewable = (category) => {
    return ['image', 'video', 'audio'].includes(category);
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'document': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'image': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'video': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
      case 'audio': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'archive': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      
      {/* =============================================================
         1. Header: Brand editorial, Stats & Logout
         ============================================================= */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-16 pb-8 border-b border-gray-400/10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-current/5 border border-gray-400/5 text-[9px] font-mono tracking-widest text-secondary uppercase font-bold relative">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            telegram_drive_workstation / online
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 border border-[var(--border-color)] rounded-xl text-[var(--accent-color)] bg-current/5 shadow-[0_0_15px_var(--shadow-glow)]">
              <FolderOpen className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left">
              <h1 className="text-md font-bold uppercase tracking-wider title-font text-current">
                Telegram Cloud Storage
              </h1>
              <p className="text-[10px] text-secondary font-mono">
                SECURED SYSTEM NODE: <span className="font-bold underline text-[var(--accent-color)]">@{user?.username || 'Admin'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard fast statistics */}
        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
          {/* Active files card */}
          <div className="flex-1 min-w-[120px] lg:flex-none glass-panel px-5 py-3 rounded-xl border border-gray-400/10 relative overflow-hidden text-left font-mono">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[var(--accent-color)] to-transparent"></div>
            <span className="text-[8px] text-secondary uppercase tracking-widest block font-bold">ACTIVE FILES</span>
            <span className="text-lg font-black text-[var(--accent-color)] block mt-1">{stats?.totalFiles || 0}</span>
          </div>

          {/* Volume stats card */}
          <div className="flex-1 min-w-[140px] lg:flex-none glass-panel px-5 py-3 rounded-xl border border-gray-400/10 relative overflow-hidden text-left font-mono">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[var(--accent-color)] to-transparent"></div>
            <span className="text-[8px] text-secondary uppercase tracking-widest block font-bold">ALLOCATED VOLUME</span>
            <span className="text-lg font-black text-current block mt-1">{stats ? formatFileSize(stats.totalSize) : '0 Bytes'}</span>
          </div>
          
          {/* Logout button */}
          {!isTWA && (
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 border border-red-500/20 hover:border-red-500 text-red-500 hover:bg-red-500/5 text-[9px] font-mono uppercase tracking-widest cursor-pointer transition rounded-xl font-bold h-[54px] flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          )}
        </div>
      </header>

      {/* =============================================================
         2. CATEGORY EXPLORER WIDGET (CẢM HỨNG QUICK TUTORIALS)
         ============================================================= */}
      <section className="mb-12 animate-fade-in delay-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black title-font uppercase tracking-tight">Hệ Thống Thư Mục</h2>
            <p className="text-[10px] text-secondary mt-0.5 font-mono">HORIZONTAL DIRECTORY SLIDES</p>
          </div>
          {stats?.tags && stats.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center justify-end max-w-xl">
              <span className="text-[8px] font-mono text-secondary uppercase font-bold flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[var(--accent-color)]" /> Hot tags:
              </span>
              {stats.tags.slice(0, 5).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="px-2 py-0.5 text-[8px] font-mono rounded bg-current/5 border border-gray-400/5 hover:border-[var(--accent-color)] transition text-secondary hover:text-current cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Categories as horizontal scroll list */}
        <div className="flex overflow-x-auto lg:overflow-x-visible gap-4 pt-2 pb-4 px-2 -mx-2 scrollbar-none snap-x snap-mandatory">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            
            return (
              <div
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setPage(1);
                }}
                className={`group relative overflow-hidden rounded-xl p-4 border cursor-pointer flex flex-row items-center gap-4 min-w-[170px] lg:min-w-0 flex-1 shrink-0 lg:shrink h-20 transition-all duration-300 snap-start ${
                  isActive 
                    ? 'border-[var(--accent-color)] bg-current/[0.04] shadow-[0_8px_20px_var(--shadow-glow)] scale-[1.02]' 
                    : 'border-gray-400/10 hover:border-[var(--accent-color)]/30 bg-zinc-900/10 hover:bg-zinc-900/20 hover:scale-[1.01]'
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Background visual cover gradient */}
                <div 
                  className="absolute inset-0 opacity-10 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none"
                  style={{ background: cat.coverBg }}
                ></div>
                
                {/* Icon wrapper */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                  isActive ? 'bg-[var(--accent-color)] text-zinc-950 shadow-md' : 'bg-current/5 text-secondary group-hover:text-current'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Info titles */}
                <div className="space-y-0.5 text-left font-mono truncate min-w-0 flex-1">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wider leading-tight group-hover:text-[var(--accent-color)] transition-colors">
                    {cat.label}
                  </h3>
                  <p className="text-[8px] text-secondary leading-snug truncate">
                    {cat.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
          {/* Spacer to prevent clipping on scroll end */}
          <div className="w-2 shrink-0 lg:hidden" />
        </div>
      </section>

      {/* =============================================================
         3. Main Workspace Layout: Full-Width Files Grid & Search
         ============================================================= */}
      <div className="space-y-8 animate-fade-in delay-3">
        
        {/* Title, Search input & Plus button */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-xl font-bold uppercase title-font tracking-wider">Kho Lưu Trữ</h2>
            <p className="text-xs text-secondary font-mono">
              {activeCategory === 'all' ? 'RECENT DEPOSITS / TẤT CẢ' : `CATEGORY MATRIX: ${activeCategory.toUpperCase()}`} • {totalFiles} ITEMS
            </p>
          </div>
          
          {/* Search Input bar & plus button */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4.5 top-3.5 w-4 h-4 text-secondary" />
              <input
                type="text"
                placeholder="Tìm tên tệp tin hoặc #tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-current/5 border border-gray-400/10 text-current text-xs focus:outline-none focus:border-[var(--accent-color)] placeholder:text-gray-600 focus:ring-1 focus:ring-[var(--accent-color)]/10"
              />
            </div>
            
            {/* Plus button to open upload modal */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="w-11 h-11 rounded-xl bg-[var(--accent-color)] text-zinc-950 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-[0_4px_12px_var(--shadow-glow)] shrink-0"
              title="Tải lên tệp tin mới"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Files List grid container */}
        <div className="space-y-8">
          {files.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-400/5 pb-4 font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={selectAllFiles}
                  className="px-3 py-1.5 rounded-lg border border-gray-400/10 hover:border-[var(--accent-color)] text-[9px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 text-secondary hover:text-current"
                >
                  <Check className="w-3 h-3 text-[var(--accent-color)]" />
                  {files.every(f => selectedUuids.includes(f.uuid)) ? 'Bỏ chọn trang này' : 'Chọn tất cả trang'}
                </button>
                {selectedUuids.length > 0 && (
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 rounded-lg border border-red-500/10 hover:border-red-500/30 text-[9px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 text-red-400/80 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                    Hủy chọn ({selectedUuids.length})
                  </button>
                )}
              </div>
              {selectedUuids.length > 0 && (
                <span className="text-[9px] text-[var(--accent-color)] uppercase tracking-widest animate-pulse font-bold">
                  Đang chọn: {selectedUuids.length} tệp tin
                </span>
              )}
            </div>
          )}

          {files.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {files.map((file, idx) => {
                  const isChecked = selectedUuids.includes(file.uuid);
                  return (
                    <div
                      key={file.uuid}
                      className={`premium-file-card group flex flex-col h-[290px] animate-fade-in border transition-all ${
                        isChecked 
                          ? '!border-[var(--accent-color)] bg-current/[0.01] shadow-[0_0_20px_var(--shadow-glow)]' 
                          : ''
                      }`}
                      style={{ animationDelay: `${(idx % 6) * 0.08}s` }}
                    >
                      {/* 1. Cover/Thumbnail Area */}
                      <div className="h-[135px] w-full relative overflow-hidden bg-zinc-950/40 border-b border-gray-400/10 flex items-center justify-center shrink-0">
                        {/* Premium custom checkbox button */}
                        <div className="absolute top-3 left-3 z-30">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectFile(file.uuid);
                            }}
                            className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-zinc-950 shadow-md scale-110'
                                : 'bg-black/40 border-white/20 text-transparent hover:border-[var(--accent-color)]/60 hover:bg-black/60 group-hover:text-white/20'
                            }`}
                          >
                            <Check className="w-4 h-4 text-zinc-950 font-black stroke-[3px]" />
                          </button>
                        </div>
                        {file.category === 'image' ? (
                          <div 
                            onClick={() => setPreviewFile(file)}
                            className="w-full h-full cursor-pointer overflow-hidden relative"
                          >
                            <img 
                              src={`/api/download/${file.uuid}`} 
                              alt={file.file_name} 
                              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                              <div className="p-2.5 rounded-full bg-white/10 border border-white/20 backdrop-blur text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        ) : file.category === 'video' ? (
                          <div 
                            onClick={() => setPreviewFile(file)}
                            className="w-full h-full cursor-pointer relative bg-black flex items-center justify-center"
                          >
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                            <video 
                              src={`/api/download/${file.uuid}`} 
                              className="w-full h-full object-cover opacity-50 group-hover:opacity-75 transition-opacity duration-300"
                            />
                            <div className="absolute p-2.5 rounded-full bg-white/10 border border-white/20 backdrop-blur text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Play className="w-4.5 h-4.5 fill-current" />
                            </div>
                          </div>
                        ) : file.category === 'audio' ? (
                          <div 
                            onClick={() => setPreviewFile(file)}
                            className="w-full h-full cursor-pointer bg-zinc-900/30 p-4 flex flex-col items-center justify-center gap-2 relative"
                          >
                            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex gap-1.5 items-end justify-center h-8 w-full opacity-60">
                              <div className="w-1 bg-[var(--accent-color)] h-4 group-hover:h-8 transition-all duration-300"></div>
                              <div className="w-1 bg-[var(--accent-color)] h-7 group-hover:h-3 transition-all duration-300"></div>
                              <div className="w-1 bg-[var(--accent-color)] h-3 group-hover:h-9 transition-all duration-300"></div>
                              <div className="w-1 bg-[var(--accent-color)] h-8 group-hover:h-5 transition-all duration-300"></div>
                              <div className="w-1 bg-[var(--accent-color)] h-5 group-hover:h-7 transition-all duration-300"></div>
                            </div>
                            <span className="text-[7.5px] font-mono text-secondary tracking-wider">AUDIO TRACK</span>
                          </div>
                        ) : (
                          /* Zip / Doc / Other files */
                          <div 
                            onClick={() => isPreviewable(file.category) && setPreviewFile(file)}
                            className="w-full h-full bg-zinc-900/30 p-4 flex flex-col justify-between text-left relative overflow-hidden"
                          >
                            <div className="absolute inset-0 opacity-5" style={{ 
                              backgroundImage: `linear-gradient(45deg, var(--text-primary) 25%, transparent 25%), 
                                                linear-gradient(-45deg, var(--text-primary) 25%, transparent 25%)`,
                              backgroundSize: '16px 16px' 
                            }}></div>
                            <div className="flex justify-between items-start font-mono text-[7px] text-secondary">
                              <span>DRIVE NODE</span>
                              <span className="px-1.5 py-0.5 rounded bg-current/5 border border-gray-400/10 font-bold uppercase text-[7px]">
                                .{file.file_name.split('.').pop() || 'FILE'}
                              </span>
                            </div>
                            <div className="font-mono text-left">
                              <div className="text-xl font-black tracking-tighter opacity-15 uppercase font-display leading-none text-[var(--accent-color)]">
                                {file.category}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Hover Action buttons list overlay */}
                        <div className="file-actions-overlay">
                          {/* Direct Download */}
                          <a
                            href={`/api/download/${file.uuid}`}
                            className="circular-action-btn !w-9 !h-9 bg-black/45 border-white/10 hover:bg-[var(--accent-color)] hover:text-black hover:border-[var(--accent-color)]"
                            title="Tải trực tiếp về máy"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Public Web Link */}
                          <button
                            onClick={() => handleCopyWebLink(file.uuid)}
                            className="circular-action-btn !w-9 !h-9 bg-black/45 border-white/10 hover:bg-[var(--accent-color)] hover:text-black hover:border-[var(--accent-color)]"
                            title="Copy Link tải web trực tiếp"
                          >
                            {copiedState.uuid === file.uuid && copiedState.type === 'web' ? (
                              <span className="text-[7px] font-mono font-bold">COPIED</span>
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Telegram Bot Link */}
                          <button
                            onClick={() => handleCopyTelegramLink(file.uuid)}
                            className="circular-action-btn !w-9 !h-9 bg-black/45 border-white/10 hover:bg-[var(--accent-color)] hover:text-black hover:border-[var(--accent-color)]"
                            title="Copy Link tải qua Bot Telegram"
                          >
                            {copiedState.uuid === file.uuid && copiedState.type === 'tg' ? (
                              <span className="text-[7px] font-mono font-bold">TG LINK</span>
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete File */}
                          <button
                            onClick={() => setDeleteConfirmFile(file)}
                            disabled={deletingUuid === file.uuid}
                            className="circular-action-btn !w-9 !h-9 bg-black/45 border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600"
                            title="Xóa tệp khỏi đám mây"
                          >
                            {deletingUuid === file.uuid ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 2. Content Area */}
                      <div className="flex-1 p-4 flex flex-col justify-between text-left relative z-10">
                        <div className="space-y-2.5">
                          {/* Top row: Category Badge & File Size */}
                          <div className="flex items-center justify-between font-mono text-[8px]">
                            <span className={`px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border ${getCategoryBadgeClass(file.category)}`}>
                              {file.category}
                            </span>
                            <span className="text-secondary font-semibold">
                              {formatFileSize(file.file_size)}
                            </span>
                          </div>

                          {/* Middle: File Name */}
                          <h4 
                            onClick={() => isPreviewable(file.category) && setPreviewFile(file)}
                            className={`text-xs font-bold tracking-tight break-all font-display leading-snug line-clamp-2 transition-colors hover:text-[var(--accent-color)] ${
                              isPreviewable(file.category) ? 'cursor-pointer hover:underline' : ''
                            }`}
                            title={file.file_name}
                          >
                            {file.file_name}
                          </h4>
                        </div>

                        {/* Bottom row: Tags, Edit tags button & Date */}
                        <div className="pt-2 border-t border-dashed border-gray-400/10 mt-3 flex items-center justify-between">
                          {/* Tags */}
                          <div className="flex flex-wrap items-center gap-1 overflow-hidden max-w-[70%]">
                            {file.tags ? (
                              file.tags.split(',').slice(0, 2).map(tag => {
                                const cleanTag = tag.trim();
                                if (!cleanTag) return null;
                                return (
                                  <span 
                                    key={cleanTag}
                                    className="px-1.5 py-0.5 rounded bg-zinc-900/40 border border-gray-400/5 text-[7px] font-mono text-secondary hover:border-[var(--accent-color)]/30 transition-colors"
                                  >
                                    #{cleanTag}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[7px] text-secondary italic font-mono opacity-40">no tags</span>
                            )}
                            <button 
                              onClick={() => startEditTags(file)}
                              className="p-0.5 text-secondary hover:text-[var(--accent-color)] transition cursor-pointer"
                              title="Sửa nhãn dán"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          
                          {/* Date */}
                          <span className="text-[7px] font-mono text-secondary tracking-tight">
                            {formatDate(file.uploaded_at).split(',')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="border border-dashed border-[var(--border-color)] rounded-2xl p-16 text-center font-mono">
                <Database className="w-12 h-12 text-[var(--accent-color)] mx-auto mb-4 opacity-40 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest">HỘP LƯU TRỮ RỖNG</p>
                <p className="text-[10px] text-secondary mt-1 max-w-sm mx-auto">
                  Không tìm thấy tệp tin nào tương thích. Vui lòng kéo thả tệp tin vào khu vực bên trái để đẩy lên đám mây Telegram.
                </p>
              </div>
            )}

            {/* Pagination Load More button (Nút 3D Perspective Tilt) */}
            {files.length < totalFiles && !isLoading && (
              <div className="text-center pt-8">
                <button
                  onClick={handleLoadMore}
                  className="btn-3d-tilt text-[10px] font-mono uppercase tracking-widest font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Load more resources ({files.length}/{totalFiles})
                </button>
              </div>
            )}

            {/* Spinner loading element */}
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* =============================================================
           FOOTER: MINIMAL CONTACT BADGE
           ============================================================= */}
        <footer className="pt-6 border-t border-gray-400/10 mt-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-current/5 border border-gray-400/10 flex items-center justify-center font-bold text-[10px] text-[var(--accent-color)] font-mono shadow-sm">
              MT
            </div>
            <div className="text-left font-mono leading-none">
              <h4 className="text-[10px] font-bold uppercase tracking-wide text-current">MẠNH TRƯỜNG</h4>
              <span className="text-[7.5px] text-secondary uppercase tracking-wider block mt-0.5">System Admin</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <a 
              href="https://www.facebook.com/mtruong25" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-7 h-7 rounded-lg border border-gray-400/5 hover:border-[var(--accent-color)]/30 hover:bg-current/5 transition-all text-secondary hover:text-current flex items-center justify-center cursor-pointer"
              title="Facebook"
            >
              <Facebook className="w-3.5 h-3.5 text-[#1877F2] opacity-80 hover:opacity-100 transition-opacity" />
            </a>
            
            <a 
              href="mailto:mtruong2509@gmail.com" 
              className="w-7 h-7 rounded-lg border border-gray-400/5 hover:border-[var(--accent-color)]/30 hover:bg-current/5 transition-all text-secondary hover:text-current flex items-center justify-center cursor-pointer"
              title="Gmail"
            >
              <Mail className="w-3.5 h-3.5 text-[#EA4335] opacity-80 hover:opacity-100 transition-opacity" />
            </a>
            
            <a 
              href="https://github.com/mtzwyu" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-7 h-7 rounded-lg border border-gray-400/5 hover:border-[var(--accent-color)]/30 hover:bg-current/5 transition-all text-secondary hover:text-current flex items-center justify-center cursor-pointer"
              title="GitHub"
            >
              <Github className="w-3.5 h-3.5 opacity-80 hover:opacity-100 transition-opacity" />
            </a>
            
            <a 
              href="tel:+840343100223" 
              className="w-7 h-7 rounded-lg border border-gray-400/5 hover:border-[var(--accent-color)]/30 hover:bg-current/5 transition-all text-secondary hover:text-current flex items-center justify-center cursor-pointer"
              title="+84 343 100 223"
            >
              <Phone className="w-3.5 h-3.5 text-[var(--accent-color)] opacity-80 hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </footer>

      {/* =============================================================
         MODAL 1: FILE PREVIEW LIGHTBOX
         ============================================================= */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden p-6 flex flex-col items-center text-white shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {/* Close button */}
            <button 
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* File info */}
            <div className="w-full text-left mb-6 pr-12 font-mono">
              <span className="text-[9px] text-[var(--accent-color)] uppercase tracking-widest block font-bold">Preview mode activated</span>
              <h3 className="text-sm font-bold truncate break-all uppercase text-gray-100 mt-1">{previewFile.file_name}</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(previewFile.file_size)} • {formatDate(previewFile.uploaded_at)}</p>
            </div>

            {/* Lightbox display body */}
            <div className="w-full flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-auto rounded-xl bg-black/80 p-4 border border-white/5">
              {previewFile.category === 'image' && (
                <img 
                  src={`/api/download/${previewFile.uuid}`} 
                  alt={previewFile.file_name} 
                  className="max-w-full max-h-[55vh] object-contain rounded"
                />
              )}
              {previewFile.category === 'video' && (
                <video 
                  src={`/api/download/${previewFile.uuid}`} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-[55vh] rounded"
                />
              )}
              {previewFile.category === 'audio' && (
                <div className="flex flex-col items-center justify-center p-8 w-full max-w-md font-mono">
                  <div className="w-20 h-20 rounded-full bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)] animate-pulse mb-6">
                    <Music className="w-8 h-8" />
                  </div>
                  <audio 
                    src={`/api/download/${previewFile.uuid}`} 
                    controls 
                    autoPlay
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Modal actions footer */}
            <div className="w-full flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <a
                href={`/api/download/${previewFile.uuid}`}
                className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 hover:bg-gray-200"
              >
                <Download className="w-4 h-4" /> Download document
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         MODAL 2: TAGS EDITOR POPUP
         ============================================================= */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-[var(--border-color)]">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[var(--accent-color)]" /> EDIT FILE LABELS (TAGS)
            </h3>
            
            <p className="text-xs text-secondary mb-4 truncate break-all font-mono">
              File: <span className="text-current font-bold">{editingFile.file_name}</span>
            </p>

            <div className="space-y-4">
              <div className="space-y-2 font-mono">
                <label className="text-[9px] text-secondary block font-bold uppercase tracking-wider">
                  Enter comma-separated tags below:
                </label>
                <input
                  type="text"
                  placeholder="e.g. report, design, work..."
                  value={tempTags}
                  onChange={(e) => setTempTags(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-current/5 border border-gray-400/10 focus:outline-none text-current text-xs focus:border-[var(--accent-color)]"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingFile(null)}
                  className="flex-1 py-2.5 rounded-full border border-gray-400/10 text-secondary hover:bg-current/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTags}
                  className="flex-1 py-2.5 rounded-full btn-3d-tilt text-[10px] uppercase font-mono tracking-wider font-bold"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-red-500/20 text-center relative z-50">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-4 flex items-center justify-center gap-2 font-bold">
              <Trash2 className="w-3.5 h-3.5 text-red-500 animate-pulse" /> HÀNH ĐỘNG HỦY HOẠI
            </h3>
            
            <h4 className="text-sm font-bold uppercase tracking-wide text-current mb-2 font-display leading-relaxed break-all">
              Bạn có chắc chắn muốn xóa file "{deleteConfirmFile.file_name}"?
            </h4>
            
            <p className="text-[10px] text-[var(--text-secondary)] font-mono mb-6 max-w-sm mx-auto leading-relaxed">
              CẢNH BÁO: Thao tác này sẽ xóa tệp vĩnh viễn khỏi máy chủ đệm và xóa tin nhắn chứa file trên Telegram. Hành động này không thể hoàn tác.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmFile(null)}
                className="flex-1 py-2.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-current hover:bg-current/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteFile}
                className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/10"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.message && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in font-mono">
          <div className={`px-5 py-3 rounded-xl border backdrop-blur-md shadow-2xl flex items-center gap-2.5 ${
            toast.type === 'error'
              ? 'bg-red-950/90 border-red-500/30 text-red-300'
              : toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/90 border-[var(--border-color)] text-[var(--accent-color)]'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}

      {/* =============================================================
         MODAL 3: UPLOAD MODAL
         ============================================================= */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-[var(--border-color)] relative">
            {/* Close button */}
            <button 
              onClick={() => setIsUploadOpen(false)}
              className="absolute top-4 right-4 p-2 bg-current/5 hover:bg-current/10 border border-gray-400/5 text-current rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="mb-4 text-left font-mono">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-color)]">Tải lên tệp tin mới</h3>
              <p className="text-[8px] text-secondary mt-0.5">UPLOAD NEW SYSTEM RESOURCES</p>
            </div>

            <UploadZone 
              onUploadSuccess={(newFile) => {
                handleUploadSuccess(newFile);
              }} 
              onAllComplete={() => {
                setIsUploadOpen(false);
              }}
              theme={theme} 
            />
          </div>
        </div>
      )}

      {/* =============================================================
         MODAL 4: BULK DELETE CONFIRMATION
         ============================================================= */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-red-500/20 text-center relative z-50">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-4 flex items-center justify-center gap-2 font-bold">
              <Trash2 className="w-3.5 h-3.5 text-red-500 animate-pulse" /> HÀNH ĐỘNG HỦY HOẠI HÀNG LOẠT
            </h3>
            
            <h4 className="text-sm font-bold uppercase tracking-wide text-current mb-2 font-display leading-relaxed break-all">
              Bạn có chắc chắn muốn xóa {selectedUuids.length} file đã chọn?
            </h4>
            
            <p className="text-[10px] text-[var(--text-secondary)] font-mono mb-6 max-w-sm mx-auto leading-relaxed">
              CẢNH BÁO: Thao tác này sẽ xóa tất cả {selectedUuids.length} tệp vĩnh viễn khỏi máy chủ đệm và xóa tin nhắn chứa các file này trên Telegram. Hành động này không thể hoàn tác.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-current hover:bg-current/5 text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeBulkDelete}
                className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/10"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         MODAL 5: BULK DELETE PROGRESS
         ============================================================= */}
      {bulkDeleteProgress.isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 border border-[var(--accent-color)]/30 text-center relative z-50">
            <div className="relative w-10 h-10 mx-auto mb-4">
              <div className="absolute inset-0 border-2 border-red-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-t-red-500 rounded-full animate-spin"></div>
            </div>
            
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent-color)] mb-2 font-bold">
              ĐANG TIẾN HÀNH XÓA FILE HÀNG LOẠT
            </h3>
            
            <p className="text-xs font-bold text-current font-mono mb-4">
              Đã xóa: {bulkDeleteProgress.current} / {bulkDeleteProgress.total} tệp tin
            </p>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-current/5 rounded-full overflow-hidden border border-[var(--border-color)]">
              <div 
                className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-300" 
                style={{ width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%` }}
              ></div>
            </div>
            
            <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-3">
              Vui lòng không đóng cửa sổ hoặc tải lại trang trong khi hệ thống đang xử lý.
            </p>
          </div>
        </div>
      )}

      {/* =============================================================
         FLOATING BULK ACTION BAR
         ============================================================= */}
      {selectedUuids.length > 0 && !bulkDeleteProgress.isDeleting && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg glass-panel rounded-2xl p-4 border border-[var(--accent-color)]/30 shadow-[0_15px_50px_rgba(0,0,0,0.8)] flex items-center justify-between gap-4 animate-slide-up-in text-[var(--text-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)] font-mono text-xs font-black">
              {selectedUuids.length}
            </div>
            <div className="text-left font-mono">
              <span className="text-[9px] text-[var(--accent-color)] uppercase tracking-widest block font-bold">LỰA CHỌN HIỆN TẠI</span>
              <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">Đã chọn {selectedUuids.length} tệp tin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-current/5 text-[9px] font-mono uppercase tracking-wider font-bold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[9px] font-mono uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa ({selectedUuids.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
