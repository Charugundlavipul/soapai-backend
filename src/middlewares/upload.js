import multer from 'multer';
import { uploadToMinio, BUCKETS, MINIO_PUBLIC_URL } from '../config/minio.js';
import { mustBeMemoryStorage } from './uploadGuards.js';
// Configure multer to use memory storage for MinIO uploads
const storage = multer.memoryStorage();

// Create multer instance with file size limits and type filtering
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow video files
    if (file.fieldname === 'video') {
      if (file.mimetype.startsWith('video/') || file.mimetype === 'video/webm' || file.originalname.endsWith('.webm')) {
        console.log('✅ Video file type accepted:', file.mimetype);
        cb(null, true);
      } else {
        console.log('❌ Invalid video file type:', file.mimetype);
        cb(new Error('Only video files are allowed for video uploads'), false);
      }
    }
    // Allow image files for avatars
    else if (file.fieldname === 'avatar') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for avatars'), false);
      }
    }
    // Allow any file for materials and attachments
    else {
      cb(null, true);
    }
  }
});

// Middleware to handle MinIO upload after multer processes the file
const handleMinioUpload = (bucketType = 'MATERIALS') => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      const file = req.file;
      const bucketName = BUCKETS[bucketType];
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop();
      const objectName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
      
      // Upload to MinIO
      await uploadToMinio(bucketName, objectName, file.buffer, file.mimetype);
      
      // Store MinIO info in request for controller to use
      req.minioFile = {
        originalName: file.originalname,
        objectName,
        bucketName,
        mimetype: file.mimetype,
        size: file.size,
        url: getPublicUrl(bucketName, objectName)
      };
      
      next();
    } catch (error) {
      console.error('MinIO upload error:', error);
      next(error);
    }
  };
};

// Main export for general file uploads
export const uploader = {
  single: (fieldName) => {
    let bucketType = 'MATERIALS';
    if (fieldName === 'video') bucketType = 'VIDEOS';
    if (fieldName === 'avatar') bucketType = 'AVATARS';
    
    return [
      upload.single(fieldName),
      handleMinioUpload(bucketType)
    ];
  },
  array: (fieldName, maxCount) => {
    return [
      upload.array(fieldName, maxCount),
      async (req, res, next) => {
        if (!req.files || req.files.length === 0) {
          return next();
        }

        try {
          const uploadedFiles = [];
          for (const file of req.files) {
            const timestamp = Date.now();
            const fileExtension = file.originalname.split('.').pop();
            const objectName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
            
            await uploadToMinio(BUCKETS.ATTACHMENTS, objectName, file.buffer, file.mimetype);
            
            uploadedFiles.push({
              originalName: file.originalname,
              objectName,
              bucketName: BUCKETS.ATTACHMENTS,
              mimetype: file.mimetype,
              size: file.size,
              url: getPublicUrl(BUCKETS.ATTACHMENTS, objectName)
            });
          }
          
          req.minioFiles = uploadedFiles;
          next();
        } catch (error) {
          next(error);
        }
      }
    ];
  }
};

// Specific middleware for video uploads
export const videoUpload = [
  (req, res, next) => {
    console.log('🎥 Video upload request received');
    next();
  },
  upload.single('video'),
  mustBeMemoryStorage('video'),
  (req, res, next) => {
    if (req.file) {
      console.log('📁 File received by multer:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } else {
      console.log('❌ No file received by multer');
    }
    next();
  },
  handleMinioUpload('VIDEOS'),
  (req, res, next) => {
    if (req.minioFile) {
      console.log('✅ File uploaded to MinIO:', {
        url: req.minioFile.url,
        bucketName: req.minioFile.bucketName,
        objectName: req.minioFile.objectName
      });
    } else {
      console.log('❌ MinIO upload failed or skipped');
    }
    next();
  }
];

// Specific middleware for avatar uploads
export const avatarUpload = [
  upload.single('avatar'),
  mustBeMemoryStorage('avatar'),
  handleMinioUpload('AVATARS')
];

// Specific middleware for material uploads
export const materialUpload = [
  upload.single('material'),
  mustBeMemoryStorage('material'),
  handleMinioUpload('MATERIALS')
];

// Specific middleware for attachment uploads
export const attachmentUpload = [
  upload.array('attachments'),
  mustBeMemoryStorage('attachments'),
  async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    try {
      const uploadedFiles = [];
      for (const file of req.files) {
        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop();
        const objectName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        
        await uploadToMinio(BUCKETS.ATTACHMENTS, objectName, file.buffer, file.mimetype);
        
        uploadedFiles.push({
          originalName: file.originalname,
          objectName,
          bucketName: BUCKETS.ATTACHMENTS,
          mimetype: file.mimetype,
          size: file.size,
          url: getPublicUrl(BUCKETS.ATTACHMENTS, objectName)
        });
      }
      
      req.minioFiles = uploadedFiles;
      next();
    } catch (error) {
      next(error);
    }
  }
];
