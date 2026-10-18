"""Record real offline kitten interactions; creates MP4, captions and a player page.

Developer tools: Playwright (with its ffmpeg recording runtime), Chromium and ffmpeg. No model API or simulated
learning results are used. User data is isolated in a temporary directory.
"""
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request

from playwright.sync_api import expect, sync_playwright

from browser_smoke import free_port

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
MEDIA = DOCS / 'media'
NAME = '小家伙的小家伙-小猫互动演示'
WIDTH, HEIGHT = 1440, 960
CURSOR = """(() => {
  const install = () => {
    const style = document.createElement('style');
    style.textContent = '#kitten-demo-cursor{position:fixed;left:-100px;top:-100px;width:28px;height:28px;transform:translate(-50%,-50%);border:2px solid #b35f8d;background:#eab8d255;border-radius:50%;pointer-events:none;z-index:100000}';
    document.head.appendChild(style);
    const cursor = document.createElement('span'); cursor.id = 'kitten-demo-cursor';
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', e => {
      const parent = document.querySelector('dialog[open]') || document.body;
      if(cursor.parentNode !== parent) parent.appendChild(cursor);
      cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';
    });
    document.addEventListener('mousedown', () => cursor.style.background = '#b35f8d99');
    document.addEventListener('mouseup', () => cursor.style.background = '#eab8d255');
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', install) : install();
})();"""


def stamp(seconds, separator=','):
    ms = round(seconds * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{separator}{ms%1000:03}'


class Director:
    def __init__(self, page, start):
        self.page, self.start, self.chapters = page, start, []

    def pause(self, seconds=2):
        self.page.wait_for_timeout(seconds * 1000)

    def chapter(self, title, text):
        self.chapters.append({'start': round(time.monotonic() - self.start, 2), 'title': title, 'text': text})
        print(title, flush=True)
        self.pause(1)

    def click(self, selector):
        node = self.page.locator(selector)
        node.scroll_into_view_if_needed()
        node.hover()
        self.pause(.35)
        node.click()
        self.pause(.8)

    def gallery(self, scene):
        self.click('.pet-quick-gallery')
        self.click(f'#pet-gallery [data-scene={scene}]')
        self.page.wait_for_function("document.querySelector('#pet-cg-image').complete && document.querySelector('#pet-cg-image').naturalWidth > 0")


def player(chapters, duration):
    rows = ''.join(f'<button type="button" data-time="{c["start"]}"><span>{int(c["start"])//60:02}:{int(c["start"])%60:02}</span><strong>{html.escape(c["title"])}</strong><small>{html.escape(c["text"])}</small></button>' for c in chapters)
    page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小猫互动演示 · 小家伙的小家伙</title><script src="kitten-demo.js" defer></script><style>
*{{box-sizing:border-box}}body{{margin:0;background:linear-gradient(130deg,#f7effa,#fff4e9);font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif;color:#44334e;line-height:1.7}}main{{max-width:1240px;margin:auto;padding:32px 24px}}a{{color:#765285}}h1{{font-size:30px;margin:8px 0}}header p{{color:#705d7b;margin:8px 0 20px}}.eyebrow{{font-size:11px;letter-spacing:2px;color:#87638d}}.layout{{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:22px;align-items:start}}video{{display:block;width:100%;border-radius:16px;background:#35253f;box-shadow:0 12px 35px #70508020}}.details{{font-size:14px;padding:16px;background:#fffafc;border:1px solid #e5d5eb;border-radius:12px;margin-top:16px}}aside{{background:#fffafc;border:1px solid #e5d5eb;border-radius:16px;padding:14px;max-height:790px;overflow:auto}}aside h2{{font-size:17px;margin:0 0 10px}}button{{width:100%;text-align:left;font:inherit;border:0;border-radius:9px;padding:10px;margin-bottom:5px;background:#f6eef9;color:#50395d;cursor:pointer}}button:hover,button:focus-visible{{background:#ebdcef;outline:2px solid #b895c5}}button span{{font-size:11px;color:#896592}}button strong{{font-size:13px;display:block}}button small{{display:block;font-size:11px;color:#77647e;margin-top:4px}}footer{{font-size:13px;margin-top:20px;color:#786580}}@media(max-width:800px){{main{{padding:22px 14px}}h1{{font-size:25px}}.layout{{grid-template-columns:1fr}}aside{{max-height:none}}}}
</style></head><body><main><header><span class="eyebrow">LITTLE MOMENTS, WITH YOU</span><h1>会散步、会撒娇的小家伙</h1><p>真实网页操作录屏 · {int(duration)//60} 分 {int(duration)%60:02} 秒 · 中文画面提示 · 无配音</p></header><div class="layout"><section><video id="kitten-video" controls playsinline preload="metadata" poster="images/15-kitten-gallery.png"><source src="media/{NAME}.mp4" type="video/mp4">请下载 MP4，使用本机视频播放器打开。</video><div class="details">点击播放，或选择章节跳转。画面已带中文提示。<br>演示从新的猫咪进度开始，全部好感通过实际点击积累；没有配置或调用模型 API。<br><a href="media/{NAME}.mp4" download>下载 MP4</a> · <a href="media/小猫互动演示字幕.srt" download>下载字幕</a> · <a href="使用说明书.html">查看详细说明书</a></div></section><aside><h2>跟着演示做一遍</h2>{rows}</aside></div><footer>好感保存在当前浏览器的本机网站数据里；清除网站数据或更换访问端口时不会自动同步。日常使用无需安装录屏工具。</footer></main></body></html>'''
    (DOCS / '小猫互动演示.html').write_text(page, encoding='utf-8')
    (DOCS / 'kitten-demo.js').write_text('''"use strict";
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-time]");
  if (!button) return;
  const video = document.querySelector("#kitten-video");
  const seek = () => {
    video.currentTime = Number(button.dataset.time);
    video.play().catch(() => {});
  };
  if (video.readyState >= 1) seek();
  else { video.addEventListener("loadedmetadata", seek, { once: true }); video.load(); }
});
''', encoding='utf-8')


def encode(raw, chapters, duration, tmp):
    subtitles = '\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(chapters[i+1]["start"] if i+1<len(chapters) else duration)}\n{c["title"]}\n{c["text"]}' for i,c in enumerate(chapters))
    (MEDIA / '小猫互动演示字幕.srt').write_text(subtitles + '\n', encoding='utf-8')
    font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
    filters = ['pad=iw:ih+104:0:0:color=0x3a2b47']
    metadata = [';FFMETADATA1', 'title=小家伙的小家伙 · 小猫互动演示']
    for index, chapter in enumerate(chapters):
        end = chapters[index+1]['start'] if index+1 < len(chapters) else duration
        for text, suffix, size, y, color in [(chapter['title'],'title',23,'h-88','0xffffff'), (chapter['text'],'detail',17,'h-47','0xebdcec')]:
            file = tmp / f'{suffix}-{index}.txt'
            file.write_text(text, encoding='utf-8')
            filters.append(f"drawtext=fontfile={font}:textfile={file}:expansion=none:fontsize={size}:fontcolor={color}:x=28:y={y}:enable='between(t,{chapter['start']},{end})'")
        metadata.extend(['[CHAPTER]', 'TIMEBASE=1/1000', f'START={round(chapter["start"]*1000)}', f'END={round(end*1000)}', 'title='+chapter['title']])
    meta = tmp / 'chapters.ffmeta'
    meta.write_text('\n'.join(metadata), encoding='utf-8')
    (MEDIA / '小猫互动演示章节.json').write_text(json.dumps({'duration':duration,'uses_model_api':False,'chapters':chapters}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Encoding MP4 with Chinese captions and chapters…', flush=True)
    with (tmp / 'ffmpeg.log').open('w') as log:
        command = ['ffmpeg','-y','-i',str(raw),'-f','ffmetadata','-i',str(meta),'-map_metadata','1','-map_chapters','1','-vf',','.join(filters),'-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-r','25','-threads','2','-movflags','+faststart',str(MEDIA / (NAME+'.mp4'))]
        result = subprocess.run(command, stdout=log, stderr=log, timeout=240)
    if result.returncode:
        raise RuntimeError((tmp / 'ffmpeg.log').read_text()[-4000:])
    player(chapters, duration)


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    errors, posts = [], []
    with tempfile.TemporaryDirectory() as folder:
        tmp = Path(folder)
        port = free_port()
        url = f'http://127.0.0.1:{port}'
        python = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        with (tmp / 'server.log').open('w') as log:
            process = subprocess.Popen([str(python),'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)], cwd=ROOT,
                                       env={**os.environ,'MEDSTUDY_DATA':str(tmp / 'data')}, stdout=log, stderr=log)
            try:
                for _ in range(70):
                    if process.poll() is not None: raise RuntimeError((tmp/'server.log').read_text())
                    try:
                        urllib.request.urlopen(url+'/api/health',timeout=1).close()
                        break
                    except OSError: time.sleep(.2)
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
                    context = browser.new_context(viewport={'width':WIDTH,'height':HEIGHT}, record_video_size={'width':WIDTH,'height':HEIGHT}, record_video_dir=str(tmp/'video'))
                    context.add_init_script(CURSOR)
                    start = time.monotonic()
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('request', lambda request: posts.append(request.url) if request.method=='POST' else None)
                    page.goto(url)
                    expect(page.locator('h1')).to_have_text('小家伙的小家伙')
                    d = Director(page, start)
                    d.chapter('01 / 认识你的猫咪伙伴', '新版小猫互动实录：摸摸、点心、毛球、散步与 CG 剧情；全程无需 API。')
                    d.pause(3)
                    d.chapter('02 / 摸摸、喂点心和逗猫', '点击右下角小猫展开互动面板；每次温柔互动，都能积累陪伴好感。')
                    d.click('.cat-companion-button'); d.pause(2)
                    for action in ['snack','play','talk']:
                        d.click(f'[data-pet-action={action}]'); d.pause(2.5)
                    expect(page.locator('#pet-affection-value')).to_have_text('10 / 100')
                    d.chapter('03 / 第一次见面的阳光 CG', '点击小猫下方的“♥ CG”；第一张回忆直接开放，可以逐句阅读并选择回应。')
                    d.gallery('sunshine'); d.pause(3)
                    d.click('[data-pet-action=next-line]'); d.pause(2)
                    d.click('[data-pet-action=next-line]'); d.click('[data-pet-action=choice] >> nth=0'); d.pause(3)
                    d.chapter('04 / 解锁雨天毛球回忆', '好感达到 10，雨天 CG 就会解锁；已收藏的回忆可以随时切换和回看。')
                    d.click('#pet-gallery [data-scene=rain]'); d.pause(3)
                    d.click('[data-pet-action=next-line]'); d.click('[data-pet-action=next-line]')
                    d.click('[data-pet-action=choice] >> nth=1'); d.pause(3)
                    d.click('[data-pet-action=close-gallery]')
                    d.chapter('05 / 再陪小猫玩一会儿', '互动反馈和好感会保留下来；不需要每天打卡，离开也不会扣分。')
                    d.click('.cat-companion-button')
                    for action in ['snack','play','talk']:
                        d.click(f'[data-pet-action={action}]'); d.pause(1.5)
                    d.chapter('06 / 让它沿页面底部爬行', '选择“让它散步”，再收起对话；摸摸它、输入文字或开始学习任务时会停下。')
                    d.click('[data-pet-action=roam]'); d.click('[data-action=close-cat]')
                    page.mouse.move(700,300)
                    expect(page.locator('#cat-companion')).to_have_attribute('data-pet-activity','walking',timeout=10000)
                    d.pause(6)
                    # Move the real pointer onto the walking cat to stop it before clicking.
                    rect = page.locator('.cat-companion-button').bounding_box()
                    page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
                    d.pause(.4); d.click('.cat-companion-button')
                    d.chapter('07 / 随时暂停动画', '暂停动画后小猫会安静陪伴；系统“减少动态效果”设置也会生效。')
                    d.click('[data-action=toggle-cat-motion]'); d.pause(3)
                    d.click('[data-action=toggle-cat-motion]'); d.click('[data-pet-action=roam]')
                    d.pause(2)
                    d.click('[data-pet-action=talk]')
                    assert page.evaluate("JSON.parse(localStorage.getItem('medstudy-kitten-companion-v1')).affection") >= 24
                    d.chapter('08 / 星夜晚安与剧情选项', '好感达到 24，或完成 3 次学习操作，可解锁星夜 CG；本片通过真实互动积累好感。')
                    d.gallery('stars'); d.pause(3)
                    d.click('[data-pet-action=next-line]'); d.pause(2)
                    d.click('[data-pet-action=next-line]'); d.click('[data-pet-action=choice] >> nth=1'); d.pause(4)
                    d.click('[data-pet-action=close-gallery]')
                    d.chapter('09 / 收起小猫，需要时再叫回', '专心学习时可以收起；右下角保留“叫回小猫”按钮，不影响课程材料和学习记录。')
                    d.click('[data-pet-action=dock]'); d.pause(3)
                    d.click('#pet-recall'); d.pause(2)
                    d.chapter('10 / 刷新后仍然记得你', '好感与收藏保存在当前浏览器；清除网站数据、更换浏览器或访问端口时不会自动同步。')
                    page.reload(); expect(page.locator('h1')).to_be_visible(); d.pause(2)
                    d.gallery('stars'); expect(page.locator('#pet-gallery .pet-scene-card:disabled')).to_have_count(0)
                    d.pause(5)
                    duration = round(time.monotonic()-start,2)
                    video = page.video
                    context.close()
                    raw = Path(video.path())
                    browser.close()
                if errors: raise AssertionError('Browser errors: '+str(errors))
                if posts: raise AssertionError('Unexpected POST requests: '+str(posts))
                encode(raw,d.chapters,duration,tmp)
                print(f'Done: {NAME}.mp4; {duration:.1f}s; {len(d.chapters)} chapters; no model API requests.',flush=True)
            finally:
                process.terminate()
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired: process.kill(); process.wait()


if __name__ == '__main__':
    main()
