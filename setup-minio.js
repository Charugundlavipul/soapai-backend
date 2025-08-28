#!/usr/bin/env node

/**
 * MinIO Setup and Testing Script
 * Run this script to test MinIO connectivity and set up buckets
 */

import dotenv from 'dotenv';
import { minioClient, BUCKETS, initializeBuckets } from './src/config/minio.js';

dotenv.config();

console.log('🔧 MinIO Setup and Testing Script\n');

// Test MinIO connection
async function testMinioConnection() {
  try {
    console.log('📡 Testing MinIO connection...');
    
    // List buckets to test connection
    const buckets = await minioClient.listBuckets();
    console.log('✅ MinIO connection successful!');
    console.log('📦 Existing buckets:', buckets.map(b => b.name));
    
    return true;
  } catch (error) {
    console.error('❌ MinIO connection failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure MinIO server is running');
    console.log('2. Check your .env file configuration');
    console.log('3. Verify MinIO endpoint and credentials');
    console.log('4. For local testing, run: docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"');
    return false;
  }
}

// Test bucket operations
async function testBucketOperations() {
  try {
    console.log('\n🪣 Testing bucket operations...');
    
    // Initialize buckets
    await initializeBuckets();
    console.log('✅ Bucket initialization completed');
    
    // Test file upload (small test file)
    const testBucket = BUCKETS.VIDEOS;
    const testObjectName = 'test-connection.txt';
    const testContent = 'This is a test file to verify MinIO connectivity.';
    
    console.log(`\n📤 Testing file upload to ${testBucket}...`);
    await minioClient.putObject(testBucket, testObjectName, Buffer.from(testContent), {
      'Content-Type': 'text/plain',
    });
    console.log('✅ Test file upload successful');
    
    // Test file download
    console.log('\n📥 Testing file download...');
    const downloadedData = await minioClient.getObject(testBucket, testObjectName);
    const chunks = [];
    for await (const chunk of downloadedData) {
      chunks.push(chunk);
    }
    const downloadedContent = Buffer.concat(chunks).toString();
    
    if (downloadedContent === testContent) {
      console.log('✅ Test file download successful');
    } else {
      console.log('⚠️  Downloaded content does not match uploaded content');
    }
    
    // Clean up test file
    console.log('\n🧹 Cleaning up test file...');
    await minioClient.removeObject(testBucket, testObjectName);
    console.log('✅ Test file removed');
    
    return true;
  } catch (error) {
    console.error('❌ Bucket operations failed:', error.message);
    return false;
  }
}

// Test presigned URLs
async function testPresignedUrls() {
  try {
    console.log('\n🔗 Testing presigned URLs...');
    
    const testBucket = BUCKETS.VIDEOS;
    const testObjectName = 'test-presigned.txt';
    const testContent = 'Testing presigned URL functionality.';
    
    // Upload test file
    await minioClient.putObject(testBucket, testObjectName, Buffer.from(testContent), {
      'Content-Type': 'text/plain',
    });
    
    // Generate presigned URL
    const presignedUrl = await minioClient.presignedGetObject(testBucket, testObjectName, 24 * 60 * 60);
    console.log('✅ Presigned URL generated:', presignedUrl);
    
    // Clean up
    await minioClient.removeObject(testBucket, testObjectName);
    console.log('✅ Test file cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Presigned URL test failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting MinIO setup and testing...\n');
  
  // Test connection
  const connectionOk = await testMinioConnection();
  if (!connectionOk) {
    console.log('\n❌ Setup failed. Please fix connection issues and try again.');
    process.exit(1);
  }
  
  // Test bucket operations
  const bucketOpsOk = await testBucketOperations();
  if (!bucketOpsOk) {
    console.log('\n❌ Bucket operations failed. Please check MinIO configuration.');
    process.exit(1);
  }
  
  // Test presigned URLs
  const presignedOk = await testPresignedUrls();
  if (!presignedOk) {
    console.log('\n❌ Presigned URL test failed.');
    process.exit(1);
  }
  
  console.log('\n🎉 All MinIO tests passed! Your setup is ready.');
  console.log('\n📋 Next steps:');
  console.log('1. Start your server: npm run dev');
  console.log('2. Test video upload through your application');
  console.log('3. When you get production credentials, update your .env file');
  console.log('4. Update MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY');
}

// Run the script
main().catch(console.error);
