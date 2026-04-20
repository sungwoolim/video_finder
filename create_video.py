import os
import re
import subprocess
import glob
from pathlib import Path

def get_audio_duration(audio_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio_path
    ]
    try:
        dur_str = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().strip()
        return float(dur_str)
    except Exception as e:
        print("Error getting audio duration:", e)
        return 0.0

def main():
    print("🎬 YouTube Local Video Generator 🎬")
    print("-----------------------------------")
    
    # Simple defaults: look in current directory
    images = glob.glob("*.png") + glob.glob("*.jpg") + glob.glob("*.jpeg")
    
    if not images:
        print("❌ Error: No images (.png, .jpg) found in the current folder.")
        print("👉 Please put your images in the same folder as this script and run it again.")
        input("Press Enter to exit...")
        return
        
    audio_path = glob.glob("*.wav")
    if not audio_path:
        print("❌ Error: No audio file (.wav) found in the current folder.")
        print("👉 Please put your audio file in the same folder and run again.")
        input("Press Enter to exit...")
        return
    audio_path = audio_path[0]
    
    script_path = glob.glob("*.txt")
    if not script_path:
        print("❌ Error: No script file (.txt) found.")
        input("Press Enter to exit...")
        return
    script_path = script_path[0]
        
    print(f"✅ Found {len(images)} images.")
    print(f"✅ Found Audio: {audio_path}")
    print(f"✅ Found Script: {script_path}")
    
    with open(script_path, "r", encoding="utf-8") as f:
        script_text = f.read()
        
    # Sort images
    num_re = re.compile(r"^(\d+)")
    sorted_pairs = []
    for p in images:
        m = num_re.match(p)
        if m:
            sorted_pairs.append((int(m.group(1)), p))
        else:
            sorted_pairs.append((999999, p))
            
    if any(x[0] != 999999 for x in sorted_pairs):
        sorted_pairs.sort(key=lambda x: x[0])
    else:
        sorted_pairs.sort(key=lambda x: x[1])
        
    ordered_images = [p for _, p in sorted_pairs]
    total_dur = get_audio_duration(audio_path)
    lines = [line.strip() for line in script_text.split("\n") if line.strip()]
    
    if not lines:
        print("❌ Error: Script is empty.")
        return
        
    durations = []
    if len(lines) != len(ordered_images):
        print(f"⚠️ Warning: Mismatch between number of text chunks ({len(lines)}) and images ({len(ordered_images)}).")
        avg = total_dur / max(1, len(ordered_images))
        durations = [avg] * len(ordered_images)
    else:
        total_chars = sum(len(line) for line in lines)
        for line in lines:
            if total_chars > 0:
                fraction = len(line) / total_chars
            else:
                fraction = 1.0 / len(lines)
            durations.append(total_dur * fraction)
            
    # Generate concat file
    concat_txt = "concat_timeline.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for idx, (img_path, dur) in enumerate(zip(ordered_images, durations)):
            # Add small padding
            d = dur + 0.1
            f.write(f"file '{img_path}'\n")
            f.write(f"duration {d:.3f}\n")
        # required last image
        f.write(f"file '{ordered_images[-1]}'\n")
        
    out_mp4 = "FINAL_YOUTUBE_VIDEO.mp4"
    if os.path.exists(out_mp4):
        os.remove(out_mp4)
        
    print("\n⏳ Rendering dynamic video with FFmpeg! This will take a few minutes...")
    
    concat_cmd = [
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-f", "concat", "-safe", "0",
        "-i", concat_txt,
        "-i", audio_path,
        "-c:v", "copy", 
        "-c:a", "aac", "-b:a", "192k",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-shortest", 
        out_mp4
    ]
    
    try:
        subprocess.run(concat_cmd, check=True)
        print(f"\n🎉 SUCCESS! Video saved as: {out_mp4}")
    except subprocess.CalledProcessError as e:
        print("\n🚨 FFmpeg Error! Ensure FFmpeg is installed and added to PATH.")
        print(e)
        
    if os.path.exists(concat_txt):
        os.remove(concat_txt)
        
    print("\nPress Enter to close this window...")
    input()
    
if __name__ == "__main__":
    main()
