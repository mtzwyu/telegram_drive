import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'frontend', 'dist');
const destDir = path.join(process.cwd(), 'backend', 'public');

function copyFolderRecursiveSync(source, target) {
  let files = [];

  // Tạo thư mục đích nếu chưa có
  const targetFolder = path.dirname(target);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Đọc toàn bộ file trong thư mục nguồn
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

try {
  console.log('📦 Bắt đầu chuyển giao diện tĩnh sang Backend...');
  
  // Dọn dẹp thư mục public cũ nếu có
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  
  if (fs.existsSync(srcDir)) {
    copyFolderRecursiveSync(srcDir, destDir);
    console.log('✅ Đã copy giao diện Frontend sang thư mục backend/public thành công!');
  } else {
    console.error('❌ Lỗi: Không tìm thấy thư mục frontend/dist. Vui lòng chạy build frontend trước.');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Lỗi khi copy thư mục:', error.message);
  process.exit(1);
}
