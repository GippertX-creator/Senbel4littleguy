"""Optional browser integration check. Needs Playwright and Chromium; no real API/key.

python scripts/browser_smoke.py --screenshot /tmp/medstudy.png
The stub replaces only the external model server; all workbench routes, storage,
uploads, extraction, export and browser interactions run normally.
"""
import argparse
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


class ModelStub(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        prompt = payload['messages'][-1]['content']
        time.sleep(0.6)  # Make the asynchronous thinking state observable in a real browser.
        if payload['model'] == 'invalid-model':
            body = b'{"error":{"message":"test-only authentication failure"}}'
            self.send_response(401);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            return
        match = re.search(r'\[材料 ([0-9a-f]{32}) \| [^\n]+? \| ([^\]]+)\]', prompt)
        refs = [{'material_id':match[1], 'unit':match[2]}] if match else []
        question = {'stem':'研究温度作用时，其他条件应该如何处理？','options':['保持一致','同时改变','任意改变','不设置对照'],'answer':0,'explanation':'保持其他条件一致，可以比较温度的影响。','topic':'对照设计','sources':refs}
        if '"title": "Outline"' in prompt:
            result = {'summary':'酶活性与实验对照的学习清单。','items':[
                {'term':'温度与酶活性','explanation':'温度会影响酶活性。','importance':'核心','recall_question':'怎样研究温度的影响？','sources':refs},
                {'term':'对照实验','explanation':'研究温度时保持其他条件一致。','importance':'核心','recall_question':'为什么需要保持其他条件一致？','sources':refs}],
                'connections':[{'chain':'温度变化 → 酶活性变化','explanation':'通过控制变量进行比较。','sources':refs}]}
        elif '"title": "Quiz"' in prompt:
            count = int(re.search(r'生成 (\d+) 道',prompt)[1])
            result = {'questions':[question for _ in range(count)]}
        elif '"title": "Comparison"' in prompt:
            result = {'left_name':'温度','right_name':'pH','rows':[
                {'dimension':'变量','left':'温度变化','right':'pH 变化','sources':refs},
                {'dimension':'实验设计','left':'其他条件一致','right':'其他条件一致','sources':refs}],
                'memory_tip':'每次比较一个变量。','practice':[question,question]}
        elif '"title": "Feedback"' in prompt:
            result = {'understood':['提到了酶活性与温度'],'corrections':[],
                      'missing':[{'student_claim':'缺少对照设计','feedback':'补充如何保持其他条件一致。','sources':refs}],
                      'next_question':'你会如何设置对照？'}
        elif '"title": "Report"' in prompt:
            result = {'title':'温度对酶活性的影响','sections':[{'key':key,'title':title,'content':content,'sources':refs} for key,title,content in [
                ('purpose','实验目的','观察温度对酶活性的影响。'),('principle','实验原理','温度与 pH 会影响酶活性。'),
                ('equipment','仪器与试剂','试管、淀粉酶。'),('steps','实验步骤','设置温度梯度，保持其他条件一致。'),
                ('precautions','注意事项','使用对照组。')]], 'pre_questions':[question,question,question]}
        elif '"title": "Answer"' in prompt:
            result = {'answer':'研究温度的作用时，应保持其他条件一致。','follow_up':'你会如何设置对照？','sources':refs}
        else:
            result = 'OK'
        content = result if isinstance(result,str) else json.dumps(result,ensure_ascii=False)
        body = json.dumps({'choices':[{'finish_reason':'stop','message':{'content':content}}]},ensure_ascii=False).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot',type=Path)
    parser.add_argument('--browser-path',default=shutil.which('chromium'))
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1',0),ModelStub)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    errors = []
    with tempfile.TemporaryDirectory() as tmp:
        port=free_port();url=f'http://127.0.0.1:{port}'
        executable=ROOT/'.venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
        if not executable.exists(): executable=Path(sys.executable)
        env={**os.environ,'MEDSTUDY_DATA':str(Path(tmp)/'data')}
        log=Path(tmp)/'server.log'
        with log.open('w') as output:
            process=subprocess.Popen([str(executable),'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=output,stderr=output)
            try:
                for _ in range(60):
                    if process.poll() is not None: raise RuntimeError(log.read_text())
                    try:
                        with urllib.request.urlopen(url+'/api/health',timeout=1): break
                    except OSError: time.sleep(.2)
                with sync_playwright() as p:
                    browser=p.chromium.launch(headless=True,executable_path=args.browser_path, args=['--no-sandbox'])
                    page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
                    page.on('pageerror',lambda error: errors.append(str(error)))
                    page.goto(url)
                    expect(page.locator('h1')).to_have_text('小家伙的小家伙')
                    expect(page).to_have_title('小家伙的小家伙 · 基础医学学习工作台')
                    expect(page.locator('.hero-cat .cat-image')).to_be_visible()
                    assert page.locator('.hero-cat .cat-image').evaluate('img => img.complete && img.naturalWidth > 0')
                    page.locator('.hero-cat-button').click()
                    expect(page.locator('#cat-companion')).to_have_attribute('data-cat-state','petting')
                    expect(page.locator('#cat-bubble')).to_be_visible()
                    page.locator('#cat-motion-toggle').click()
                    expect(page.locator('body')).to_have_attribute('data-cat-motion','off')
                    assert page.locator('.hero-cat .cat-image').evaluate('node => getComputedStyle(node).animationName') == 'none'
                    page.locator('#cat-motion-toggle').click()
                    page.locator('[data-action=close-cat]').click()
                    expect(page.locator('#cat-bubble')).not_to_be_visible()
                    page.emulate_media(reduced_motion='reduce')
                    assert page.locator('.hero-cat .cat-image').evaluate('node => getComputedStyle(node).animationName') == 'none'
                    page.emulate_media(reduced_motion='no-preference')
                    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                    def nav(view):
                        page.locator(f'#navigation a[href="#{view}"]').click()
                        expect(page.locator(f'#navigation a[href="#{view}"]')).to_have_class(re.compile('active'))
                    nav('settings')
                    page.locator('[name=base_url]').fill(f'http://127.0.0.1:{server.server_port}/v1')
                    page.locator('[name=model]').fill('browser-test-model')
                    page.locator('[name=api_key]').fill('browser-test-only')
                    page.locator('[data-action=test-api]').click()
                    expect(page.locator('#cat-companion')).to_have_attribute('data-cat-state','thinking')
                    expect(page.locator('#toast')).to_contain_text('API 请求成功')
                    expect(page.locator('#cat-companion')).to_have_attribute('data-cat-state','success')
                    page.locator('[name=model]').fill('invalid-model')
                    page.locator('[data-action=test-api]').click()
                    expect(page.locator('#cat-companion')).to_have_attribute('data-cat-state','error')
                    expect(page.locator('#task-error')).to_contain_text('API 密钥无效')
                    page.locator('[name=model]').fill('browser-test-model')
                    page.locator('[data-action=test-api]').click()
                    page.locator('.cat-companion-button').click()
                    expect(page.locator('#cat-companion')).to_have_attribute('data-cat-state','thinking')
                    expect(page.locator('#cat-message')).to_contain_text('收到摸摸')
                    expect(page.locator('#toast')).to_contain_text('API 请求成功')
                    page.locator('#course-select').select_option('biochemistry')
                    nav('materials')
                    page.locator('[name=kind]').select_option('experiment')
                    page.locator('[name=files]').set_input_files({'name':'酶活性.txt','mimeType':'text/plain','buffer':'酶活性受温度和 pH 影响。实验目的：研究温度的作用。原理：酶催化反应。仪器与试剂：试管、淀粉酶。实验步骤：设置温度梯度，保持其他条件一致。注意事项：使用对照组。'.encode()})
                    page.locator('#upload-form button[type=submit]').click()
                    expect(page.locator('.list-info h3')).to_have_text('酶活性.txt')
                    page.locator('.list-actions [data-action=source]').click()
                    expect(page.locator('#source-dialog')).to_be_visible()
                    expect(page.locator('#source-content')).to_contain_text('酶催化反应')
                    page.locator('#close-dialog').click()
                    nav('outline');page.locator('#outline-form button[type=submit]').click()
                    expect(page.locator('.knowledge-card')).to_have_count(2)
                    page.locator('[data-action=recall]').click();expect(page.locator('#toast')).to_contain_text('新增 2')
                    nav('chat');page.locator('[name=message]').fill('为什么要控制其他条件？');page.locator('#chat-form button[type=submit]').click()
                    expect(page.locator('#tutor-thinking')).to_be_visible()
                    expect(page.locator('.message.assistant')).to_contain_text('其他条件一致')
                    expect(page.locator('#tutor-thinking')).to_have_count(0)
                    nav('teach');page.locator('[name=topic]').fill('温度与酶活性');page.locator('[name=explanation]').fill('温度会影响酶活性。');page.locator('#teach-form button[type=submit]').click()
                    expect(page.locator('.result-container')).to_contain_text('补充如何保持其他条件一致')
                    expect(page.locator('[name=explanation]')).to_have_value('温度会影响酶活性。')
                    nav('report');page.locator('[name=title]').fill('温度对酶活性的影响');page.locator('#report-form button[type=submit]').click()
                    expect(page.locator('.report-section')).to_have_count(5)
                    with page.expect_download() as download:
                        page.get_by_role('link',name='下载 Word ↓').click()
                    file_path=download.value.path();assert Path(file_path).stat().st_size>1000
                    page.locator('.result-container [data-action=artifact]').click()
                    expect(page.locator('.quiz-card')).to_have_count(3)
                    for i in range(3):page.locator(f'[name=q{i}][value="{1 if i==0 else 0}"]').check()
                    page.locator('#grade-form button[type=submit]').click()
                    expect(page.locator('.score-strip strong')).to_have_text('2 / 3')
                    nav('practice');page.locator('[data-tab=compare]').click()
                    page.locator('[name=left]').fill('温度');page.locator('[name=right]').fill('pH');page.locator('[name=guess]').fill('这是两个不同的实验条件。')
                    page.locator('#compare-form button[type=submit]').click()
                    expect(page.locator('.compare-table')).to_contain_text('温度变化')
                    expect(page.locator('.quiz-card')).to_have_count(2)
                    nav('figures')
                    image=Image.new('RGB',(600,400),'#e8eee6');buffer=io.BytesIO();image.save(buffer,'PNG')
                    page.locator('#figure-upload-form [name=file]').set_input_files({'name':'细胞结构.png','mimeType':'image/png','buffer':buffer.getvalue()})
                    page.locator('#figure-upload-form button[type=submit]').click()
                    expect(page.locator('#figure-stage')).to_be_visible()
                    page.locator('#figure-stage').click(position={'x':150,'y':120})
                    page.locator('[name^=name-]').fill('细胞核 / nucleus');page.locator('[name^=explanation-]').fill('测试标注来源')
                    page.locator('[name=confirmed]').check();page.locator('#labels-form button[type=submit]').click()
                    expect(page.locator('#toast')).to_contain_text('标注已保存')
                    page.locator('[data-mode=practice]').click()
                    expect(page.locator('#figure-grade-form input')).to_have_count(1)
                    page.locator('#figure-grade-form input').fill('错误结构');page.locator('#figure-grade-form button[type=submit]').click()
                    expect(page.locator('#figure-grade-form')).to_contain_text('0 / 1')
                    nav('review');page.locator('[name=answer]').fill('尝试回忆后对照材料。');page.locator('#review-form button[type=submit]').click()
                    expect(page.locator('#review-form')).to_contain_text('参考内容')
                    page.locator('[data-remembered=true]').click();expect(page.locator('#toast')).to_contain_text('下次复习')
                    nav('home')
                    if args.screenshot:
                        page.locator('#toast').evaluate("node => node.className = ''")
                        page.locator('[data-action=close-cat]').click()
                        args.screenshot.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(args.screenshot),full_page=True,animations='disabled')
                    page.set_viewport_size({'width':390,'height':844})
                    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile layout overflows'
                    expect(page.locator('.hero-cat .cat-image')).to_be_visible()
                    if args.screenshot:
                        page.screenshot(path=str(args.screenshot.with_name(args.screenshot.stem+'-mobile.png')),full_page=True,animations='disabled')
                    page.locator('#menu-button').click();expect(page.locator('#sidebar')).to_have_class('sidebar open')
                    nav('settings');expect(page.locator('#settings-form')).to_be_visible()
                    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Settings overflows'
                    browser.close()
                    if errors:raise AssertionError('Browser errors: '+str(errors))
                    print('Browser integration PASS: brand, cat asset, pet interaction, thinking/success states, pause animation, reduced motion, API settings, upload, citations, outline, recall, tutor, teach-back, report download, quiz grading, concept comparison, image labels, image practice, spaced review, desktop/mobile; no JavaScript errors.')
            finally:
                process.terminate()
                try:process.wait(timeout=10)
                except subprocess.TimeoutExpired:process.kill();process.wait()
    server.shutdown();server.server_close()


if __name__=='__main__':
    main()
