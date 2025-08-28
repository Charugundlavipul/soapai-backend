
import dotenv from "dotenv";
import { minioClient, BUCKETS } from '../config/minio.js';

// Load environment variables
dotenv.config();

// NEW OPENAI WHISPER API IMPLEMENTATION
export async function transcribe(objectName) {
  try {
    // Check if OpenAI API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not found in environment variables");
    }

    // Get the video buffer from MinIO
    const videoBuffer = await new Promise((resolve, reject) => {
      let buffers = [];
      minioClient.getObject(BUCKETS.VIDEOS, objectName)
        .then(stream => {
          stream.on('data', chunk => buffers.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(buffers)));
          stream.on('error', err => reject(err));
        })
        .catch(err => reject(err));
    });
    
    // Create form data for OpenAI API
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', videoBuffer, {
      filename: 'video.webm',
      contentType: 'video/webm'
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities', 'segment');

    // Make request to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    // Transform OpenAI response to match expected format
    const segments = result.segments.map(segment => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim()
    }));

    return segments;
  } catch (error) {
    console.error('OpenAI Whisper transcription failed:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Helper function to parse time strings (kept for compatibility)
function parseTimeToSeconds(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(ts) || 0;
}