import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

import httpx

ROOT = Path(__file__).resolve().parent.parent


class LauncherTests(unittest.TestCase):
    @unittest.skipIf(os.name == 'nt', 'This automated signal check uses POSIX SIGINT; test Windows Ctrl+C manually.')
    def test_ctrl_c_stops_child_server(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0))
            port=sock.getsockname()[1]
        with tempfile.TemporaryDirectory() as tmp:
            env={**os.environ,'MEDSTUDY_DATA':str(Path(tmp)/'data')}
            with (Path(tmp)/'launch.log').open('w') as output:
                process=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port',str(port)],cwd=ROOT,env=env,stdout=output,stderr=output)
                try:
                    with httpx.Client(trust_env=False,timeout=1) as client:
                        for _ in range(80):
                            if process.poll() is not None:
                                self.fail('Launcher exited before readiness: '+(Path(tmp)/'launch.log').read_text())
                            try:
                                response=client.get(f'http://127.0.0.1:{port}/api/health')
                                if response.status_code==200:break
                            except httpx.HTTPError:
                                time.sleep(.1)
                        else:self.fail('Server did not become ready')
                    process.send_signal(signal.SIGINT)
                    self.assertEqual(process.wait(timeout=15),0)
                    with socket.socket() as probe:
                        probe.settimeout(.5)
                        self.assertNotEqual(probe.connect_ex(('127.0.0.1',port)),0,'Child server survived Ctrl+C')
                finally:
                    if process.poll() is None:
                        process.send_signal(signal.SIGINT)
                        try:process.wait(timeout=15)
                        except subprocess.TimeoutExpired:process.kill();process.wait()
