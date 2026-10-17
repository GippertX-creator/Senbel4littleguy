# 首版验证记录

验证日期：2026-10-14。执行环境：Linux、Python 3.12、Chromium。测试数据为隔离的合成材料，不属于真实课程结论。

2026-10-17 文档更新：新增 3 分 24 秒真实网页录屏（固定模拟 API、15 个中文步骤章节、无配音）、14 张界面截图、23 页 PDF 说明书、Word/HTML/Markdown 版和练习材料。录屏没有使用真实 API 密钥，未录制 Windows 安装过程。新增文档路由与视频分段请求验证，本次自动化测试 25 / 25 通过。

| 检查 | 结果 | 验证内容 |
| --- | --- | --- |
| 全新虚拟环境安装 | 通过 | 运行 `python launch.py --install-only`，所有依赖安装成功，`pip check` 通过 |
| 重复安装 | 通过 | 相同依赖清单复用安装标记，不重复安装 |
| 本地服务启动 | 通过 | 启动脚本运行 Uvicorn，健康请求与静态界面正常 |
| 后端自动化测试 | 24 / 24 通过 | PDF / PPTX / DOCX / 文本解析、课程隔离、来源检查、API 配置、答案隐藏、评分、复习、Word 模板、图片标注及启动器退出时关闭子服务 |
| 浏览器完整流程 | 通过 | 配置模拟 API、上传、查看来源、知识清单、主动回忆、连续答疑、讲解反馈、报告下载、实验小测、概念对照、指图评分、复习调度 |
| 浏览器运行错误 | 0 | 完整流程无未处理 JavaScript 错误 |
| 响应式界面 | 通过 | 桌面 1440px 与移动 390px，检查首页与设置无横向溢出、移动导航可用 |
| 猫咪学习伙伴 | 通过 | 猫咪图片载入、摸猫、思考/完成/错误状态、处理中摸猫不会中断请求、助教输入提示、暂停动画和系统减少动态效果 |
| Windows x64 / Python 3.12 依赖 | 包可获取 | 已从 PyPI 下载对应 Windows wheels，包括 PyMuPDF、Pillow、lxml、pydantic-core，另检查 Windows colorama 依赖 |
| 真实 Windows 启动 | 未执行 | 需要在用户 Windows 电脑上双击 `start.bat` 验证 |
| 真实模型生成 | 未执行 | 未提供真实 API。模拟服务用于测试软件协议和流程，不验证生成内容质量 |
| 外部教材链接连通性 | 未确认 | 当前云网络策略限制 OpenStax / NCBI 访问；保留已知官方入口，用户电脑网络情况不同 |

运行测试：

```bash
.venv/bin/python -m unittest discover -s tests -v
python scripts/browser_smoke.py --screenshot /tmp/medstudy.png
```

浏览器测试需要在测试用 Python 环境安装 Playwright 和 Chromium；可使用 `--browser-path /path/to/chromium`。生产使用不需要 Playwright 或 Node.js。

打包：`python scripts/package.py`。生成 `dist/小家伙的小家伙-Windows.zip`，仅包含代码、猫咪资源、部署脚本和文档，排除原始材料、数据库、密钥和虚拟环境。
