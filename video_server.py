import re
import math
import subprocess
import threading
import uuid
import time
import whisper
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

        # ── Sort images by leading number in filename ──────────────────────
        num_re = re.compile(r"^(\d+)")
        sorted_pairs = []
        for p in img_dir.glob("*"):
            m = num_re.match(p.name)
            sorted_pairs.append((int(m.group(1)) if m else 999999, p))
        sorted_pairs.sort(key=lambda x: (x[0], x[1].name))
        ordered_images = [p for _, p in sorted_pairs]

        total_dur = get_audio_duration(str(audio_path))

        # ── Whisper STT: word-level timestamps ────────────────────────────
        JOBS[job_id]["progress"] = 2
        JOBS[job_id]["status"] = "analyzing"
        JOBS[job_id]["message"] = "Whisper AI 모델로 밀리초(ms) 단위 오디오 타이밍을 추출 중입니다..."
        
        # Whisper 로딩 및 타임스탬프 추출
        model = whisper.load_model("base")
        w_result = model.transcribe(
            str(audio_path),
            word_timestamps=True,
            language="ko"
        )
        
        all_words = []
        for seg in w_result.get("segments", []):
            for wi in seg.get("words", []):
                all_words.append(wi)

        import difflib

        # ── Calculate per-image durations using difflib text alignment ────
        lines = [l.strip() for l in script_text.split("\n") if l.strip()]
        
        target_durations = []
        if all_words and lines:
            # 1. Map Whisper text to exact timestamps per character
            whisper_chars = ""
            char_to_time = []
            for w in all_words:
                word_text = w.get("word", "").replace(" ", "")
                start_time = w.get("start", 0.0)
                end_time = w.get("end", 0.0)
                w_len = len(word_text)
                for i in range(w_len):
                    whisper_chars += word_text[i]
                    # Interpolate time for each character
                    char_time = start_time + (end_time - start_time) * ((i + 1) / w_len)
                    char_to_time.append(char_time)
            
            # 2. Build script chars and line boundaries
            script_chars = ""
            line_end_indices = []
            for line in lines:
                clean_line = line.replace(" ", "")
                script_chars += clean_line
                line_end_indices.append(len(script_chars) - 1)
            
            # 3. Match script against Whisper text
            matcher = difflib.SequenceMatcher(None, script_chars, whisper_chars)
            blocks = matcher.get_matching_blocks()
            
            def get_whisper_time(script_idx):
                if not char_to_time:
                    return 0.0
                
                # Check if exact match in block
                for i, j, n in blocks:
                    if i <= script_idx < i + n:
                        w_idx = j + (script_idx - i)
                        return char_to_time[w_idx]
                
                # If not, find the nearest block before it
                best_j = 0
                for i, j, n in blocks:
                    if n == 0: continue
                    if i <= script_idx:
                        best_j = j + n - 1
                    else:
                        break
                
                best_j = min(best_j, len(char_to_time) - 1)
                return char_to_time[best_j]

            # 4. Extract basic matched times
            raw_durations = []
            prev_time = 0.0
            for end_idx in line_end_indices:
                end_t = get_whisper_time(end_idx)
                raw_durations.append(max(0.1, end_t - prev_time))
                prev_time = end_t
            raw_durations[-1] += max(0.0, total_dur - sum(raw_durations))
            
            # 5. Outlier smoothing (Pooling anomalies from difflib mismatch)
            total_script_chars = max(1, sum(len(line.replace(" ", "")) for line in lines))
            pool_time = 0.0
            pool_chars = 0
            pool_indices = []
            
            for i, dur in enumerate(raw_durations):
                char_count = len(lines[i].replace(" ", ""))
                expected = total_dur * (char_count / total_script_chars)
                
                # Pool anomalous durations (either huge jump or missing mapping)
                if dur > max(15.0, expected * 3) or dur <= 0.11:
                    pool_time += dur
                    pool_chars += char_count
                    pool_indices.append(i)
                else:
                    if pool_indices:
                        for pi in pool_indices:
                            pi_chars = len(lines[pi].replace(" ", ""))
                            target_durations.append(pool_time * (pi_chars / max(1, pool_chars)))
                        pool_indices = []
                        pool_time = 0.0
                        pool_chars = 0
                    target_durations.append(dur)
                    
            if pool_indices:
                for pi in pool_indices:
                    pi_chars = len(lines[pi].replace(" ", ""))
                    target_durations.append(pool_time * (pi_chars / max(1, pool_chars)))
            
        elif lines:
            # Whisper 타이밍 추출 실패 시: 단순히 원본 글자 수 기반 전체 시간 비율 분배
            total_chars = max(1, sum(len(x.replace(" ", "")) for x in lines))
            for line in lines:
                w = len(line.replace(" ", ""))
                target_durations.append(total_dur * (w / total_chars))

        # 업로드된 이미지 개수와 대본 라인 수(target_durations) 불일치 대응
        num_images = len(ordered_images)
        durations = []
        if target_durations:
            if len(target_durations) == num_images:
                durations = target_durations
            elif len(target_durations) > num_images:
                JOBS[job_id]["message"] = f"대본 수({len(target_durations)})가 이미지 수({num_images})보다 많아 남은 시간을 마지막 이미지에 병합합니다."
                durations = target_durations[:num_images-1]
                durations.append(sum(target_durations[num_images-1:]))
            else:
                JOBS[job_id]["message"] = f"대본 수({len(target_durations)})가 이미지 수({num_images})보다 작아 남은 이미지에 임의 시간을 배정합니다."
                durations = target_durations + [1.0] * (num_images - len(target_durations))
                factor = total_dur / sum(durations)
                durations = [d * factor for d in durations]
        else:
            durations = [total_dur / max(1, num_images)] * num_images

        JOBS[job_id]["status"] = "processing"
        JOBS[job_id]["progress"] = 5

        # ── Resolution ────────────────────────────────────────────────────
        try:
            resolution = get_image_resolution(str(ordered_images[0]))
        except Exception:
            resolution = "1080x1920"

        fps = 30
        zoom_target = 1.1

        # ── Build tasks with drift-corrected durations ────────────────────
        tasks = []
        concat_lines = []
        cumulative_time = 0.0

        for i, (img, dur) in enumerate(zip(ordered_images, durations), start=1):
            if dur <= 0:
                continue
                
            # 소수점 반올림 누적 오차(Drift) 방지: 누적 시간을 기준으로 프레임 계산
            start_frame = int(round(cumulative_time * fps))
            cumulative_time += dur
            end_frame = int(round(cumulative_time * fps))
            
            actual_frames = end_frame - start_frame
            if actual_frames <= 0:
                continue
            
            actual_dur = actual_frames / fps

            tasks.append((i, img, actual_dur))
            concat_lines.append(f"file 'part_{i:04d}.mp4'")

        total_images = len(tasks)

        # ── Parallel zoompan render per chunk ────────────────────────────
        import concurrent.futures

        def render_chunk(args):
            i, img, dur = args
            chunk_file = tmp_path / f"part_{i:04d}.mp4"
            frames = int(round(dur * fps))
            zoom_step = (zoom_target - 1.0) / frames if frames > 0 else 0
            w_px, h_px = map(int, resolution.split("x"))

            # 4배 스케일링 후 줌팬 적용 (Jittering 흔들림 방지 꼼수)
            vf = (
                f"scale={w_px*4}:{h_px*4},"
                f"zoompan=z='min(zoom+{zoom_step:.6f},{zoom_target})':"
                f"d={frames}:"
                f"x='iw/2-(iw/zoom)/2':"
                f"y='ih/2-(ih/zoom)/2':"
                f"s={resolution},"
                f"framerate={fps}"
            )

            cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(img.resolve()),
                "-vf", vf,
                "-c:v", "h264_videotoolbox", "-b:v", "5M", "-allow_sw", "1",
                "-pix_fmt", "yuv420p",
                "-t", str(dur),
                str(chunk_file.name)
            ]
            subprocess.run(cmd, check=True, cwd=str(tmp_path))
            return i

        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(render_chunk, t): t for t in tasks}
            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result()
                    completed += 1
                    # 5% ~ 95% 구간 진행률 업데이트
                    JOBS[job_id]["progress"] = 5 + int((completed / total_images) * 90)
                    JOBS[job_id]["message"] = f"비디오 조각 렌더링 중... ({completed} / {total_images} 완료)"
                except Exception as e:
                    print(f"Chunk render error: {e}")
                    JOBS[job_id]["status"] = "error"
                    JOBS[job_id]["error"] = str(e)
                if JOBS[job_id].get("status") == "error":
                    return

        # ── Concat + audio + loudnorm ─────────────────────────────────────
        concat_list = tmp_path / "concat.txt"
        concat_list.write_text("\n".join(concat_lines), encoding="utf-8")

        out_mp4 = tmp_path / "output.mp4"
        concat_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0",
            "-i", concat_list.name,
            "-i", audio_path.name,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-shortest",
            out_mp4.name
        ]
        
        JOBS[job_id]["progress"] = 96
        JOBS[job_id]["message"] = "모든 조각과 오디오 트랙을 1개의 동영상으로 병합 및 정규화 중입니다..."
        subprocess.run(concat_cmd, check=True, cwd=str(tmp_path))

        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["message"] = "🎉 렌더링 서버 작업 완료!"
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
            
            # Message 이스케이프 (줄바꿈이나 따옴표 등)
            msg = job.get('message', 'Processing...')
            msg = msg.replace('"', '\\"').replace('\n', ' ')
            
            yield f"data: {{\"progress\": {job['progress']}, \"status\": \"{job['status']}\", \"message\": \"{msg}\"}}\n\n"
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
