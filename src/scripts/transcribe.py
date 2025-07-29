#!/usr/bin/env python3
import sys, json, tempfile, subprocess, os, logging
import whisper

logging.getLogger("moviepy").setLevel(logging.ERROR)

MODEL = "base"
LANG  = "en"
MINSEC = True

# ---------- helpers ----------
def fmt_sec(s, mmss=MINSEC):
    return f"{int(s//60)}:{int(s%60):02d}" if mmss else f"{s:.2f}"

def to_seekable(src_path):
    """
    Chrome-recorded WebM often has no duration/index → MoviePy blows up.
    We re-wrap it into a temp .mkv WITH index using ffmpeg -c copy.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".mkv", delete=False)
    tmp.close()
    cmd = [
        "ffmpeg", "-y",               # overwrite
        "-i", src_path,
        "-c", "copy",                # no re-encode
        "-map", "0",                 # all streams
        tmp.name
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return tmp.name

def extract_wav(video_path):
    """Use ffmpeg directly → sidestep MoviePy entirely."""
    wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    wav.close()
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",                     # no video
        "-ac", "1",                # mono
        "-ar", "16000",            # 16 kHz
        "-c:a", "pcm_s16le",
        wav.name
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return wav.name

# ---------- main ----------
def main(video_path: str):
    # 1) Ensure the container is seek-able
    fixed = to_seekable(video_path)

    # 2) Extract WAV for Whisper
    wav   = extract_wav(fixed)

    # 3) Run Whisper
    model  = whisper.load_model(MODEL)
    result = model.transcribe(wav, language=LANG)

    segments = [
        {
            "start": fmt_sec(seg["start"]),
            "end":   fmt_sec(seg["end"]),
            "text":  seg["text"].strip()
        }
        for seg in result.get("segments", [])
    ]

    # cleanup
    os.remove(wav)
    os.remove(fixed)

    # 4) **Only** emit JSON
    sys.stdout.write(json.dumps(segments, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: transcribe.py <video_file>\n")
        sys.exit(1)
    main(sys.argv[1])
