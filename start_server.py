"""Launch video_server.py as a true daemon (new session, detached from terminal)."""
import subprocess, sys, os

server_dir = os.path.dirname(os.path.abspath(__file__))

# venv Python을 우선 사용 (Flask 등 패키지가 설치된 환경)
venv_python = os.path.join(server_dir, "venv", "bin", "python3")
python = venv_python if os.path.exists(venv_python) else sys.executable

log = open(os.path.join(server_dir, "server.log"), "w")

p = subprocess.Popen(
    [python, "-u", "video_server.py"],
    cwd=server_dir,
    stdout=log,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    start_new_session=True,   # detaches from current process group
    close_fds=True,
)
print(f"✅ video_server.py started as daemon. PID={p.pid} (Python: {python})")
