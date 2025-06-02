import { spawn }       from "child_process";
import path            from "path";
import { json } from "stream/consumers";
import { fileURLToPath } from "url";

// restore __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// point at your venv’s python
const isWin = process.platform === "win32";
const VENV_ROOT = path.resolve(__dirname, "../../.venv");
const PYTHON = isWin
  ? path.join(VENV_ROOT, "Scripts", "python.exe")
  : path.join(VENV_ROOT, "bin", "python");
// export async function transcribe(videoPath) {
//   return new Promise((resolve, reject) => {
//     const script = path.resolve(__dirname, "../scripts/transcribe.py");
//     const py = spawn("python", [script, videoPath], {
//       stdio: ["ignore","pipe","pipe"]
//     });

//     let out = "", err = "";
//     py.stdout.on("data", chunk => out += chunk.toString());
//     py.stderr.on("data", chunk => err += chunk.toString());

//     py.on("error", reject);
//     py.on("close", code => {
//       if (code !== 0) {
//         return reject(new Error(`Transcription failed (${code}):\n${err}`));
//       }

      
//       const start = out.indexOf('[');
//       const end   = out.lastIndexOf(']');
//       if (start === -1 || end === -1 || end < start) {
//         return reject(new Error("No valid JSON array found in transcriber output"));
//       }

      
//       const jsonText = out.slice(start, end + 1).trim();

      
//       try {
      
//         const segments = JSON.parse(jsonText);
//         resolve(segments);
//       } catch (e) {
//         reject(new Error("Invalid JSON from transcriber: " + e.message));
//       }
//     });
//   });
// }

function parseTimeToSeconds(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(ts) || 0;
}

export async function transcribe(videoPath) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '../scripts/transcribe.py');
    const py = spawn('python', [script, videoPath]);

    let out = '', err = '';
    py.stdout.on('data', c => out += c.toString());
    py.stderr.on('data', c => err += c.toString());

    py.on('error', reject);
    py.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Transcription failed (${code}):\n${err}`));
      }

      // ① find the first '['
      const first = out.indexOf('[');
      if (first < 0) {
        return reject(new Error(`No JSON array found in transcriber output.`));
      }
      // ② walk forward to find the matching ']'
      let depth = 0, endIdx = -1;
      for (let i = first; i < out.length; i++) {
        if (out[i] === '[') depth++;
        else if (out[i] === ']') {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx < 0) {
        return reject(new Error(`Incomplete JSON array in transcriber output.`));
      }

      const jsonText = out.slice(first, endIdx + 1);
      let raw;
      try {
        raw = JSON.parse(jsonText);
      } catch (e) {
        return reject(new Error(`Invalid JSON from transcriber: ${e.message}`));
      }

      // convert times into numbers
      const segments = raw.map(s => ({
        start: parseTimeToSeconds(s.start),
        end:   parseTimeToSeconds(s.end),
        text:  s.text.trim()
      }));
      resolve(segments);
    });
  });
}