import { createClient } from '@supabase/supabase-js';
import { normalizeSearchString, encryptText, decryptText } from './utils.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ CẢNH BÁO: Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường!');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

export const dbService = {
  /**
   * Lưu thông tin file vào database Supabase (Mã hóa toàn bộ metadata).
   */
  async insertFile({ uuid, fileId, fileUniqueId, messageId, fileName, fileSize, mimeType, category, tags }) {
    const metadata = {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      message_id: messageId,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      category,
      tags
    };

    const encryptedData = encryptText(JSON.stringify(metadata));
    const uploadedAt = new Date().toISOString();

    const { error } = await supabase
      .from('telegram_drive_files')
      .insert({
        uuid,
        encrypted_data: encryptedData,
        uploaded_at: uploadedAt
      });

    if (error) {
      console.error('Lỗi khi ghi Supabase insertFile:', error.message);
      throw error;
    }

    return {
      uuid,
      uploaded_at: uploadedAt,
      ...metadata
    };
  },

  /**
   * Lấy thông tin file dựa vào UUID từ Supabase.
   */
  async getFileByUuid(uuid) {
    const { data, error } = await supabase
      .from('telegram_drive_files')
      .select('*')
      .eq('uuid', uuid)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Lỗi khi lấy file từ Supabase:', error.message);
      return null;
    }

    try {
      const decrypted = decryptText(data.encrypted_data);
      const metadata = JSON.parse(decrypted);
      return {
        uuid: data.uuid,
        uploaded_at: data.uploaded_at,
        ...metadata
      };
    } catch (err) {
      console.error('Lỗi giải mã metadata cho file UUID:', uuid, err.message);
      return null;
    }
  },

  /**
   * Xóa file khỏi database Supabase.
   */
  async deleteFile(uuid) {
    const { error } = await supabase
      .from('telegram_drive_files')
      .delete()
      .eq('uuid', uuid);

    if (error) {
      console.error('Lỗi khi xóa file khỏi Supabase:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Cập nhật thẻ tag cho file trên Supabase.
   */
  async updateTags(uuid, tags) {
    const file = await this.getFileByUuid(uuid);
    if (!file) return false;

    // Cập nhật tags trong metadata
    file.tags = tags;

    // Loại bỏ các trường hệ thống không thuộc metadata trước khi mã hóa
    const { uuid: _, uploaded_at: __, ...metadata } = file;

    const encryptedData = encryptText(JSON.stringify(metadata));

    const { error } = await supabase
      .from('telegram_drive_files')
      .update({ encrypted_data: encryptedData })
      .eq('uuid', uuid);

    if (error) {
      console.error('Lỗi khi cập nhật tags trên Supabase:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Lấy danh sách file kèm tìm kiếm và phân loại (Giải mã & Lọc ở Serverless Memory).
   */
  async getFiles({ query, category, limit = 20, offset = 0 }) {
    const { data, error } = await supabase
      .from('telegram_drive_files')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Lỗi khi lấy danh sách file từ Supabase:', error.message);
      return { files: [], total: 0 };
    }

    // Giải mã và lọc dữ liệu
    const files = (data || []).map(row => {
      try {
        const decrypted = decryptText(row.encrypted_data);
        const metadata = JSON.parse(decrypted);
        return {
          uuid: row.uuid,
          uploaded_at: row.uploaded_at,
          ...metadata
        };
      } catch (err) {
        return null;
      }
    }).filter(f => f !== null);

    let filtered = files;

    // 1. Lọc theo Category
    if (category && category !== 'all') {
      filtered = filtered.filter(doc => doc.category === category);
    }

    // 2. Tìm kiếm chuẩn hóa tiếng Việt không dấu
    if (query) {
      const normalizedQuery = normalizeSearchString(query);
      const queryWords = normalizedQuery.split(' ').filter(word => word);

      filtered = filtered.filter(doc => {
        const normalizedName = normalizeSearchString(doc.file_name);
        const normalizedTags = doc.tags ? normalizeSearchString(doc.tags) : '';
        return queryWords.every(word => 
          normalizedName.includes(word) || 
          normalizedTags.includes(word)
        );
      });
    }

    // 3. Phân trang
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      files: paginated,
      total
    };
  },

  /**
   * Thống kê tổng số lượng file, dung lượng và danh sách tags.
   */
  async getStats() {
    const { data, error } = await supabase
      .from('telegram_drive_files')
      .select('*');

    if (error) {
      console.error('Lỗi khi lấy dữ liệu stats từ Supabase:', error.message);
      return { totalFiles: 0, totalSize: 0, categoryStats: [], tags: [] };
    }

    const files = (data || []).map(row => {
      try {
        const decrypted = decryptText(row.encrypted_data);
        const metadata = JSON.parse(decrypted);
        return {
          uuid: row.uuid,
          uploaded_at: row.uploaded_at,
          ...metadata
        };
      } catch (err) {
        return null;
      }
    }).filter(f => f !== null);

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, doc) => sum + doc.file_size, 0);

    // Tính thống kê theo từng Category
    const categoryMap = {};
    files.forEach(doc => {
      if (!categoryMap[doc.category]) {
        categoryMap[doc.category] = { count: 0, size: 0 };
      }
      categoryMap[doc.category].count += 1;
      categoryMap[doc.category].size += doc.file_size;
    });

    const categoryStats = Object.keys(categoryMap).map(cat => ({
      category: cat,
      count: categoryMap[cat].count,
      size: categoryMap[cat].size
    }));

    // Gom tất cả các thẻ tags độc bản
    const tagSet = new Set();
    files.forEach(doc => {
      if (doc.tags) {
        doc.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });

    return {
      totalFiles,
      totalSize,
      categoryStats,
      tags: Array.from(tagSet)
    };
  }
};
