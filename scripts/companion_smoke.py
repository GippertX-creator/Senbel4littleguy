"""Real-browser companion checks. No external model or API key required."""
import argparse
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from browser_smoke import free_port

ROOT = Path(__file__).resolve().parent.parent
KEY = "medstudy-kitten-companion-v1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', type=Path, default=Path('/tmp/kitten-gallery.png'))
    args = parser.parse_args()
    errors = []
    with tempfile.TemporaryDirectory() as tmp:
        port = free_port()
        url = f'http://127.0.0.1:{port}'
        python = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        with (Path(tmp) / 'server.log').open('w') as output:
            process = subprocess.Popen([str(python), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
                                       cwd=ROOT, env={**os.environ, 'MEDSTUDY_DATA': str(Path(tmp) / 'data')}, stdout=output, stderr=output)
            try:
                for _ in range(60):
                    if process.poll() is not None:
                        raise RuntimeError((Path(tmp) / 'server.log').read_text())
                    try:
                        urllib.request.urlopen(url + '/api/health', timeout=1).close()
                        break
                    except OSError:
                        time.sleep(.2)
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
                    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(url)
                    expect(page.locator('h1')).to_have_text('小家伙的小家伙')
                    posts = []
                    page.on('request', lambda request: posts.append(request.url) if request.method == 'POST' else None)
                    page.locator('.pet-quick-gallery').click()
                    gallery = page.locator('#pet-gallery')
                    expect(gallery).to_be_visible()
                    expect(gallery.locator('.pet-scene-card:disabled')).to_have_count(2)
                    expect(page.locator('#pet-story-line')).to_contain_text('你回来啦')
                    page.locator('[data-pet-action=next-line]').click()
                    page.locator('[data-pet-action=next-line]').click()
                    page.locator('[data-pet-action=choice]').first.click()
                    expect(page.locator('#pet-story-line')).to_contain_text('呼噜呼噜')
                    expect(page.locator('[data-pet-action=next-line]')).to_be_focused()
                    page.keyboard.press('Escape')
                    expect(gallery).not_to_be_visible()
                    expect(page.locator('.pet-quick-gallery')).to_be_focused()
                    page.locator('.cat-companion-button').click()
                    for action in ['snack', 'play', 'talk']:
                        page.locator(f'[data-pet-action={action}]').click()
                    expect(page.locator('#pet-affection-value')).to_have_text('10 / 100')
                    args.screenshot.parent.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(args.screenshot.with_name(args.screenshot.stem + '-interaction.png')), animations='disabled')
                    page.locator('#cat-bubble [data-pet-action=gallery]').click()
                    expect(gallery.locator('.pet-scene-card:disabled')).to_have_count(1)
                    gallery.locator('[data-scene=rain]').click()
                    expect(page.locator('#pet-story-line')).to_contain_text('下雨了')
                    page.wait_for_function("document.querySelector('#pet-cg-image').complete && document.querySelector('#pet-cg-image').naturalWidth > 0")
                    args.screenshot.parent.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(args.screenshot), animations='disabled')
                    page.keyboard.press('Escape')
                    page.locator('[data-pet-action=roam]').click()
                    page.locator('[data-action=close-cat]').click()
                    page.mouse.move(500, 300)
                    expect(page.locator('#cat-companion')).to_have_attribute('data-pet-activity', 'walking', timeout=10000)
                    expect(page.locator('.pet-walk-sprite')).to_be_visible()
                    page.wait_for_timeout(800)
                    rect = page.locator('#cat-companion').bounding_box()
                    assert rect['x'] >= 0 and rect['x'] + rect['width'] <= 1441, 'Walking cat must remain in viewport'
                    page.locator('#navigation a[href="#outline"]').click()
                    page.locator('#outline-form [name=topic]').fill('受体与第二信使')
                    assert page.locator('#cat-companion').get_attribute('data-pet-activity') != 'walking'
                    typing_position = page.locator('#cat-companion').bounding_box()['x']
                    page.wait_for_timeout(600)
                    assert abs(page.locator('#cat-companion').bounding_box()['x'] - typing_position) < 1, 'Typing must pause roaming'
                    page.locator('#navigation a[href="#home"]').click()
                    page.locator('.cat-companion-button').click()
                    page.locator('[data-action=toggle-cat-motion]').click()
                    page.locator('[data-action=close-cat]').click()
                    assert page.locator('.pet-walk-sprite').evaluate('n => getComputedStyle(n).animationName') == 'none'
                    page.wait_for_timeout(600)
                    assert page.locator('#cat-companion').get_attribute('data-pet-activity') != 'walking'
                    affection_before_reload = page.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).affection")
                    page.reload()
                    expect(page.locator('h1')).to_be_visible()
                    page.locator('.cat-companion-button').click()
                    expect(page.locator('#pet-affection-value')).to_have_text(f'{min(100, affection_before_reload + 2)} / 100')
                    page.locator('[data-pet-action=dock]').click()
                    expect(page.locator('#cat-companion')).not_to_be_visible()
                    expect(page.locator('#pet-recall')).to_be_visible()
                    page.reload()
                    expect(page.locator('#pet-recall')).to_be_visible()
                    page.locator('#pet-recall').click()
                    expect(page.locator('#cat-companion')).to_be_visible()
                    page.set_viewport_size({'width': 390, 'height': 844})
                    page.locator('.pet-quick-gallery').click()
                    expect(gallery).to_be_visible()
                    assert gallery.evaluate('n => n.scrollWidth <= n.clientWidth + 1'), 'Mobile gallery must not overflow horizontally'
                    page.screenshot(path=str(args.screenshot.with_name(args.screenshot.stem + '-mobile.png')), animations='disabled')
                    page.keyboard.press('Escape')
                    assert not posts, 'Companion interactions must not send any model or learning requests'
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Companion must not widen page'
                    # Reduced motion blocks roaming even when it is enabled in preferences.
                    page.emulate_media(reduced_motion='reduce')
                    page.locator('.cat-companion-button').click()
                    page.locator('[data-action=toggle-cat-motion]').click()
                    page.locator('[data-action=close-cat]').click()
                    page.wait_for_timeout(600)
                    assert page.locator('#cat-companion').get_attribute('data-pet-activity') != 'walking'
                    # Corrupt preferences should not prevent opening the workbench.
                    clean = browser.new_page()
                    clean.on('pageerror', lambda error: errors.append(str(error)))
                    clean.add_init_script(f"localStorage.setItem('{KEY}', 'broken json')")
                    clean.goto(url)
                    expect(clean.locator('h1')).to_have_text('小家伙的小家伙')
                    clean.locator('.cat-companion-button').click()
                    expect(clean.locator('#pet-affection-value')).to_have_text('2 / 100')
                    limited = browser.new_page()
                    limited.on('pageerror', lambda error: errors.append(str(error)))
                    limited.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('Storage full', 'QuotaExceededError'); }")
                    limited.goto(url)
                    expect(limited.locator('h1')).to_have_text('小家伙的小家伙')
                    limited.locator('.cat-companion-button').click()
                    expect(limited.locator('#pet-affection-value')).to_have_text('2 / 100')
                    browser.close()
                if errors:
                    raise AssertionError('Browser errors: ' + str(errors))
                print('Companion PASS: offline interactions, CG locks/unlocks, dialogue choices, roaming bounds, pause/reduced motion, persistence, dock/recall, mobile gallery, corrupt-storage fallback; no JavaScript errors.')
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == '__main__':
    main()
