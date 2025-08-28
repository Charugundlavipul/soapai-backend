import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// MinIO configuration
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

// Public MinIO URL for client access
export const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://${minioConfig.endPoint}:${minioConfig.port}`;

// Helper to generate public URLs for files
export const getPublicUrl = (bucketName, objectName) => {
  if (!process.env.MINIO_PUBLIC_URL) {
    throw new Error('MINIO_PUBLIC_URL not configured in server environment');
  }
  return `${process.env.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`;
};

// Create MinIO client
export const minioClient = new Client(minioConfig);

// Bucket names
export const BUCKETS = {
  VIDEOS: 'videos',
  MATERIALS: 'materials',
  AVATARS: 'avatars',
  ATTACHMENTS: 'attachments'
};

// Initialize buckets if they don't exist
export const initializeBuckets = async () => {
  try {
    for (const bucketName of Object.values(BUCKETS)) {
      const exists = await minioClient.bucketExists(bucketName);
      if (!exists) {
        await minioClient.makeBucket(bucketName);
        console.log(`✅ Created bucket: ${bucketName}`);
        
        // Set bucket policy to public read for videos and materials
        if (bucketName === BUCKETS.VIDEOS || bucketName === BUCKETS.MATERIALS) {
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucketName}/*`]
              }
            ]
          };
          await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
          console.log(`✅ Set public read policy for bucket: ${bucketName}`);
        }
      }
    }
    console.log('✅ All MinIO buckets are ready');
  } catch (error) {
    console.error('❌ Error initializing MinIO buckets:', error);
    throw error;
  }
};

// Generate presigned URLs for uploads/downloads
export const generatePresignedUrl = async (bucketName, objectName, operation = 'getObject', expiry = 24 * 60 * 60) => {
  try {
    if (operation === 'getObject') {
      return await minioClient.presignedGetObject(bucketName, objectName, expiry);
    } else if (operation === 'putObject') {
      return await minioClient.presignedPutObject(bucketName, objectName, expiry);
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

// Upload file to MinIO
export const uploadToMinio = async (bucketName, objectName, fileBuffer, contentType) => {
  try {
    await minioClient.putObject(bucketName, objectName, fileBuffer, {
      'Content-Type': contentType,
    });
    return true;
  } catch (error) {
    console.error('Error uploading to MinIO:', error);
    throw error;
  }
};

// Delete file from MinIO
export const deleteFromMinio = async (bucketName, objectName) => {
  try {
    await minioClient.removeObject(bucketName, objectName);
    return true;
  } catch (error) {
    console.error('Error deleting from MinIO:', error);
    throw error;
  }
};

// Get file info from MinIO
export const getFileInfo = async (bucketName, objectName) => {
  try {
    const stat = await minioClient.statObject(bucketName, objectName);
    return stat;
  } catch (error) {
    console.error('Error getting file info from MinIO:', error);
    throw error;
  }
};
