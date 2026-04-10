import os
import re
import math
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def get_audio_duration(audio_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio_path
    ]
    return float(subprocess.check_output(cmd, text=True).strip())

def get_image_resolution(img_path: str) -> str:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        img_path
    ]
    return subprocess.check_output(cmd, text=True).strip()

@app.route('/api/make-video', methods=['POST'])
def make_video():
    if 'audio' not in request.files or 'script' not in request.form or 'images' not in request.files:
        return jsonify({"error": "Missing audio, script, or images"}), 400

    audio_file = request.files['audio']
    script_text = request.form['script']
    images = request.files.getlist('images')

    if not images:
        return jsonify({"error": "No images provided"}), 400

    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        # Save Audio
        audio_path = tmp_path / "audio.wav"
        audio_file.save(audio_path)
        
        # Save Images
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        
        saved_imgs = []
        for img in images:
            img_path = img_dir / img.filename
            img.save(img_path)
            saved_imgs.append(img_path)
            
        # Sort images by prefix if available
        num_re = re.compile(r"^(\\d+)_")
        sorted_pairs = []
        for p in saved_imgs:
            m = num_re.match(p.name)
            if m:
                sorted_pairs.append((int(m.group(1)), p))
            else:
                sorted_pairs.append((999999, p))
                
        if any(x[0] != 999999 for x in sorted_pairs):
            sorted_pairs.sort(key=lambda x: x[0])
        else:
            sorted_pairs.sort(key=lambda x: x[1].name)
            
        ordered_images = [p for _, p in sorted_pairs]
        
        total_dur = get_audio_duration(str(audio_path))
        lines = [line.strip() for line in script_text.split("\\n") if line.strip()]
        
        if len(lines) == 0:
            return jsonify({"error": "Script is empty"}), 400
            
        durations = []
        if len(lines) != len(ordered_images):
            # Mismatch fallback
            dur = total_dur / len(ordered_images)
            durations = [dur] * len(ordered_images)
        else:
            total_chars = sum(len(x.replace(" ", "")) for x in lines)
            if total_chars == 0: total_chars = 1
            for line in lines:
                w = len(line.replace(" ", ""))
                durations.append(total_dur * (w / total_chars))
                
        try:
            resolution = get_image_resolution(str(ordered_images[0]))
        except:
            resolution = "1080x1920" # fallback
            
        # Generation
        concat_list = tmp_path / "concat.txt"
        concat_lines = []
        fps = 30
        zoom_target = 1.1
        
        for i, (img, dur) in enumerate(zip(ordered_images, durations), start=1):
            if dur <= 0: continue
            
            chunk_file = tmp_path / f"part_{i:04d}.mp4"
            frames = int(math.ceil(dur * fps))
            zoom_step = (zoom_target - 1.0) / frames if frames > 0 else 0
            
            vf = (
                f"zoompan=z='min(zoom+{zoom_step:.6f},{zoom_target})':"
                f"d={frames}:"
                f"x='iw/2-(iw/zoom)/2':"
                f"y='ih/2-(ih/zoom)/2':"
                f"s={resolution},"
                f"framerate={fps}"
            )
            
            cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-loop", "1", "-t", str(dur),
                "-i", str(img),
                "-vf", vf,
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-level", "4.1",
                str(chunk_file)
            ]
            subprocess.run(cmd, check=True)
            concat_lines.append(f"file '{chunk_file.name}'")
            
        concat_list.write_text("\\n".join(concat_lines), encoding="utf-8")
        
        out_mp4 = tmp_path / "output.mp4"
        concat_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-i", str(audio_path),
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", 
            str(out_mp4)
        ]
        subprocess.run(concat_cmd, check=True, cwd=str(tmp_path))
        
        # We need to send the file back. It must be accessible after temp directory deletes.
        # TempDirectory deletes when exited. So we read it into memory.
        with open(out_mp4, 'rb') as f:
            video_data = f.read()
            
    # Send it securely from memory (or via tempfile without context manager)
    # Using a permanent tmp that gets cleaned up might be better, but memory is fine for a 15 min video (approx 100-300MB) locally.
    from io import BytesIO
    return send_file(
        BytesIO(video_data),
        mimetype="video/mp4",
        as_attachment=True,
        download_name="Final_YouTube_Video.mp4"
    )

if __name__ == '__main__':
    print("🎬 Video Rendering Backend is running on http://localhost:5000")
    print("Press Ctrl+C to stop.")
    app.run(host='127.0.0.1', port=5000)
