#!/usr/bin/env node

/**
 * List All Uploaded Videos
 * This script shows all videos stored in your database
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Import Video model
const Video = (await import('./src/models/Video.js')).default;

async function listVideos() {
  try {
    console.log('📹 Fetching all videos...\n');
    
    const videos = await Video.find({}).sort({ createdAt: -1 });
    
    if (videos.length === 0) {
      console.log('📭 No videos found in the database.');
      return;
    }
    
    console.log(`🎥 Found ${videos.length} video(s):\n`);
    
    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title || 'Untitled Video'}`);
      console.log(`   📅 Uploaded: ${new Date(video.createdAt).toLocaleString()}`);
      console.log(`   🔗 URL: ${video.fileUrl}`);
      
      if (video.minioInfo) {
        console.log(`   🪣 MinIO Bucket: ${video.minioInfo.bucketName}`);
        console.log(`   📁 Object Name: ${video.minioInfo.objectName}`);
      }
      
      if (video.goals && video.goals.length > 0) {
        console.log(`   🎯 Goals: ${video.goals.join(', ')}`);
      }
      
      if (video.notes) {
        console.log(`   📝 Notes: ${video.notes}`);
      }
      
      console.log(`   🆔 ID: ${video._id}`);
      console.log(''); // Empty line for separation
    });
    
    
  } catch (error) {
    console.error('❌ Error fetching videos:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

listVideos();

