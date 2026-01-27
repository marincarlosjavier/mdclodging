import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { checkStorageQuota } from './quota.js';

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenantId || 'unknown';
    const tenantDir = path.join(uploadDir, `tenant_${tenantId}`);

    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg').split(',');

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// File filter for Excel
const excelFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
  }
};

// Configure multer for images
const uploadImageMulter = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  }
});

// Configure multer for Excel files
const uploadExcelMulter = multer({
  storage: storage,
  fileFilter: excelFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  }
});

// Wrap multer with quota check
// Quota check runs AFTER multer processes file, so we can check file size
// If quota exceeded, uploaded file is deleted and error returned
export const uploadImage = [
  uploadImageMulter.single('image'),
  async (req, res, next) => {
    if (req.file) {
      // Check quota after file upload
      try {
        await checkStorageQuota(req, res, () => {
          // Quota OK, continue
          next();
        });
      } catch (error) {
        // Quota exceeded or error, delete uploaded file
        if (req.file.path) {
          deleteFile(req.file.path);
        }
        // Error already sent by checkStorageQuota
      }
    } else {
      next();
    }
  }
];

export const uploadExcel = [
  uploadExcelMulter.single('file'),
  async (req, res, next) => {
    if (req.file) {
      try {
        await checkStorageQuota(req, res, () => {
          next();
        });
      } catch (error) {
        if (req.file.path) {
          deleteFile(req.file.path);
        }
      }
    } else {
      next();
    }
  }
];

// Error handler for multer
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        maxSize: process.env.MAX_FILE_SIZE
      });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

// Helper to delete file
export function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
}
