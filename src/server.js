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
import recommendationsRouter from "./routes/recommendations.js";
import annualGoalsRoutes from "./routes/annualGoals.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve("uploads");  


dotenv.config();
const app  = express();
const port = process.env.PORT || 4000;

app.use(cors());          // allow React dev server
app.use(express.json());
    // same path we used in controller
app.use("/uploads", express.static(path.resolve("uploads")));

app.use('/api/auth', authRoutes);
app.get('/ping', (_r, res) => res.send('pong'));

app.use('/api/clients', patientRoutes);
app.use('/api/groups',  groupRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use(
  '/uploads',
  express.static(
    path.join(__dirname, '..', 'uploads')   
  )
);
app.use('/api/profile', profileRoutes);
app.use('/api/behaviours', behaviourRoutes);
app.use('/api', videoRoutes);
app.use('/api/videos', videoRoutes); 
app.use("/api/annual-goals", annualGoalsRoutes); 

app.use(errorHandler);
app.use('/api/chat', chatRoutes);
app.use("/api", recommendationsRouter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Mongo connected');
    app.listen(port, () =>
      console.log(`API ready  →  http://localhost:${port}`));
  })
  .catch(console.error);
