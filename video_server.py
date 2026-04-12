import os
import re
import math
import subprocess
import threading
import uuid
import shutil
import time
from pathlib import Path
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

JOBS = {}
JOBS_DIR = Path("jobs")
if not JOBS_DIR.exists():
    JOBS_DIR.mkdir()

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

def process_video_job(job_id, tmp_path_str, script_text):
    tmp_path = Path(tmp_path_str)
    try:
        audio_path = tmp_path / "audio.wav"
        img_dir = tmp_path / "images"
        
        saved_imgs = list(img_dir.glob("*"))
        
        # Sort images
        num_re = re.compile(r"^(\d+)")
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
        lines = [line.strip() for line in script_text.split("\n") if line.strip()]
        
        durations = []
        if len(lines) != len(ordered_images):
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
            resolution = "1080x1920" 
            
        concat_list = tmp_path / "concat.txt"
        concat_lines = []
        fps = 30
        zoom_target = 1.1
        
        total_images = len(ordered_images)
        
        # Process individual image zoompan in parallel (Max 4 workers)
        import concurrent.futures
        
        def render_chunk(args):
            i, img, dur = args
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
                "-c:v", "h264_videotoolbox", "-b:v", "5M", "-allow_sw", "1",
                "-pix_fmt", "yuv420p",
                str(chunk_file)
            ]
            subprocess.run(cmd, check=True)
            return i
            
        tasks = []
        for i, (img, dur) in enumerate(zip(ordered_images, durations), start=1):
            if dur <= 0: continue
            tasks.append((i, img, dur))
            concat_lines.append(f"file 'part_{i:04d}.mp4'")
            
        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_idx = {executor.submit(render_chunk, t): t for t in tasks}
            for future in concurrent.futures.as_completed(future_to_idx):
                try:
                    future.result()
                    completed += 1
                    progress = int((completed / total_images) * 95)
                    JOBS[job_id]["progress"] = progress
                except Exception as e:
                    print(f"Error rendering chunk: {e}")
                    JOBS[job_id]["status"] = "error"
                    JOBS[job_id]["error"] = str(e)
                    
                if JOBS[job_id].get("status") == "error":
                    return
                
        concat_list.write_text("\n".join(concat_lines), encoding="utf-8")
        
        out_mp4 = tmp_path / "output.mp4"
        concat_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-i", str(audio_path),
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-shortest", 
            str(out_mp4)
        ]
        
        JOBS[job_id]["progress"] = 96
        subprocess.run(concat_cmd, check=True, cwd=str(tmp_path))
        
        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["file"] = str(out_mp4)
        
    except Exception as e:
        print("Error processing video:", e)
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(e)


@app.route('/api/make-video', methods=['POST'])
def make_video():
    if 'audio' not in request.files or 'script' not in request.form or 'images' not in request.files:
        return jsonify({"error": "Missing audio, script, or images"}), 400

    audio_file = request.files['audio']
    script_text = request.form['script']
    images = request.files.getlist('images')

    if not images or len(images) == 0:
        return jsonify({"error": "No images provided"}), 400

    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    
    # Save files
    audio_path = job_dir / "audio.wav"
    audio_file.save(audio_path)
    
    img_dir = job_dir / "images"
    img_dir.mkdir()
    
    for img in images:
        if img.filename:
            img.save(img_dir / img.filename)
            
    JOBS[job_id] = {
        "status": "processing",
        "progress": 0,
        "error": None
    }
    
    # Start thread
    t = threading.Thread(target=process_video_job, args=(job_id, str(job_dir), script_text))
    t.start()
    
    return jsonify({"job_id": job_id})

@app.route('/api/progress/<job_id>', methods=['GET'])
def get_progress(job_id):
    def event_stream():
        while True:
            if job_id not in JOBS:
                yield f"data: {{\"error\": \"Job not found\"}}\n\n"
                break
                
            job = JOBS[job_id]
            yield f"data: {{\"progress\": {job['progress']}, \"status\": \"{job['status']}\"}}\n\n"
            
            if job["status"] in ["completed", "error"]:
                break
            time.sleep(1)
            
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/api/download/<job_id>', methods=['GET'])
def download_video(job_id):
    if job_id not in JOBS or JOBS[job_id]["status"] != "completed":
        return jsonify({"error": "Video not ready or invalid job"}), 400
        
    mp4_path = JOBS[job_id]["file"]
    return send_file(
        mp4_path,
        mimetype="video/mp4",
        as_attachment=True,
        download_name="Final_YouTube_Video.mp4"
    )

if __name__ == '__main__':
    print("🎬 Video Rendering Backend is running on http://localhost:5000")
    print("Press Ctrl+C to stop.")
    app.run(host='127.0.0.1', port=5000, threaded=True)
