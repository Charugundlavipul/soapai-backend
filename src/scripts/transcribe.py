#!/usr/bin/env python3
import sys, json, tempfile, os
import whisper
from moviepy.video.io.VideoFileClip import VideoFileClip
import logging
logging.getLogger("moviepy").setLevel(logging.ERROR)

MODEL = "base"
LANG  = "en"
MINSEC = True

def format_time(s):
    if not MINSEC:
        return f"{s:.2f}"
    m = int(s // 60)
    sec = int(s % 60)
    return f"{m}:{sec:02d}"

def main(video_path):
    # 1) extract mono wav @16k
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = tmp.name; tmp.close()
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(tmp_path, fps=16000)
    clip.close()

    # 2) whisper
    model  = whisper.load_model(MODEL)
    result = model.transcribe(tmp_path, language=LANG)

    # 3) format segments
    segments = []
    for seg in result.get("segments", []):
        start = seg["start"]; end = seg["end"]
        text  = seg["text"].strip()
        if MINSEC:
            def fmt(s): return f"{int(s//60)}:{int(s%60):02d}"
        else:
            def fmt(s): return f"{s:.2f}"
        segments.append({
            "start": fmt(start),
            "end":   fmt(end),
            "text":  text
        })

    # 4) cleanup
    os.remove(tmp_path)

    # 5) **ONLY** write JSON—no other prints allowed
    sys.stdout.write(json.dumps(segments, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: transcribe.py <video>\n")
        sys.exit(1)
    main(sys.argv[1])



if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: transcribe.py <video_file>\n")
        sys.exit(1)
    main(sys.argv[1])

