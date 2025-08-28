import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import patientRoutes from './routes/patients.js';
import groupRoutes   from './routes/groups.js';
import appointmentRoutes from './routes/appointments.js';
import path from 'path';
import { fileURLToPath } from 'url';
import behaviourRoutes from './routes/behaviours.js';
import profileRoutes from './routes/profile.js';
import videoRoutes from './routes/videos.js';
import chatRoutes from './routes/chat.js';
import stgRoutes from './routes/stgRoutes.js';  // for generating STG
import recommendationsRouter from "./routes/recommendations.js";
import annualGoalsRoutes from "./routes/annualGoals.js";
import { initializeBuckets } from './config/minio.js'; // Import MinIO initialization
import { startMinIOServer } from './utils/minioStarter.js'; // Import MinIO starter

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();
const app  = express();
const port = process.env.PORT || 4000;

app.use(cors());          // allow React dev server
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});


// Remove old static file serving since we're using MinIO now
// app.use("/uploads", express.static(path.resolve("uploads")));

app.use('/api/auth', authRoutes);
app.get('/ping', (_r, res) => res.send('pong'));

app.use('/api/clients', patientRoutes);
app.use('/api/groups',  groupRoutes);
app.use('/api/appointments', appointmentRoutes);


app.use('/api/profile', profileRoutes);
app.use('/api/behaviours', behaviourRoutes);
app.use('/api', videoRoutes); 
app.use("/api/annual-goals", annualGoalsRoutes); 

app.use(errorHandler);
app.use('/api/chat', chatRoutes);
app.use("/api", recommendationsRouter);
app.use('/api',            stgRoutes); 

// Initialize MinIO, MongoDB, and start the server
const initializeServices = async () => {
  try {
    // Start MinIO server if it's not running
    const minioStarted = await startMinIOServer();
    if (!minioStarted) {
      throw new Error('Failed to start MinIO server');
    }

    // Wait a bit for MinIO to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Initialize MinIO buckets
    await initializeBuckets();
    console.log('✅ MinIO buckets initialized successfully');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
    
    // Start server
    app.listen(port, () => {
      console.log(`🚀 Server ready → http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
};

initializeServices();
