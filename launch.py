"""Cross-platform launcher; start.bat uses this on Windows. Requires Python 3.11+."""
import argparse
import hashlib
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description="Little Buddy medical study workbench launcher")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--install-only", action="store_true")
    args = parser.parse_args()
    if sys.version_info < (3, 11):
        print("Please install Python 3.11 or newer (Python 3.12 recommended).")
        return 1
    if not 1024 <= args.port <= 65535:
        print("Port must be between 1024 and 65535.")
        return 1
    environment = ROOT / ".venv"
    interpreter = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not interpreter.exists():
        print("Creating a local Python environment...")
        subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True)
    requirements = ROOT / "requirements.txt"
    stamp = environment / ".requirements-hash"
    fingerprint = hashlib.sha256(requirements.read_bytes()).hexdigest()
    if not stamp.exists() or stamp.read_text() != fingerprint:
        print("Installing dependencies. The first launch requires Internet access...")
        env = os.environ.copy()
        env["PIP_CACHE_DIR"] = str(ROOT / "data" / "pip-cache")
        subprocess.run([str(interpreter), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(requirements)], cwd=ROOT, env=env, check=True)
        subprocess.run([str(interpreter), "-m", "pip", "check"], cwd=ROOT, env=env, check=True)
        stamp.write_text(fingerprint)
    if args.install_only:
        print("Dependencies are installed.")
        return 0
    with socket.socket() as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(("127.0.0.1", args.port)) == 0:
            print(f"Port {args.port} is already in use. Close the other process or run: python launch.py --port 8766")
            return 1
    url = f"http://127.0.0.1:{args.port}"
    print(f"\nLittle Buddy / Xiao Jia Huo: {url}\nKeep this window open. Press Ctrl+C to stop.\n")

    def open_when_ready():
        for _ in range(60):
            try:
                with urllib.request.urlopen(url + "/api/health", timeout=1) as response:
                    if response.status == 200:
                        webbrowser.open(url)
                        return
            except OSError:
                time.sleep(0.5)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()
    process = subprocess.Popen([str(interpreter), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(args.port)], cwd=ROOT)
    try:
        return process.wait()
    except KeyboardInterrupt:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as error:
        print(f"Setup failed (exit {error.returncode}). Check the error above and retry.")
        sys.exit(error.returncode)
