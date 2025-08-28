import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to check if a port is in use
const isPortInUse = async (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false))
          .close();
      })
      .listen(port);
  });
};

// Function to start MinIO
export const startMinIOServer = async () => {
  try {
    // Check if MinIO is already running on port 9000
    const isMinioRunning = await isPortInUse(9000);
    if (isMinioRunning) {
      console.log('✅ MinIO is already running');
      return true;
    }

    console.log('Starting MinIO server...');
    
    // Determine the correct script to run based on the platform
    const isWindows = process.platform === 'win32';
    const scriptPath = path.resolve(
      __dirname,
      '../../',
      isWindows ? 'start-minio.ps1' : 'start-minio.sh'
    );

    // Start MinIO using the appropriate command
    const minioProcess = isWindows
      ? spawn('powershell.exe', ['-File', scriptPath], {
          detached: true,
          stdio: 'inherit'
        })
      : spawn('sh', [scriptPath], {
          detached: true,
          stdio: 'inherit'
        });

    // Don't wait for the child process to exit
    minioProcess.unref();

    // Wait for MinIO to be ready
    let attempts = 0;
    while (attempts < 30) { // Try for 30 seconds
      const isRunning = await isPortInUse(9000);
      if (isRunning) {
        console.log('✅ MinIO server started successfully');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
    }

    throw new Error('MinIO server failed to start within 30 seconds');
  } catch (error) {
    console.error('❌ Failed to start MinIO server:', error);
    return false;
  }
};
