"""Portable Chinese PDF export using PyMuPDF's bundled CJK font."""
from pathlib import Path
from uuid import uuid4

import fitz


def blocks(artifact):
    data = artifact["data"]
    yield artifact["title"], 19
    yield "医学学习资料 · 请对照课程原文核对", 10
    evidence = data.get("evidence",{})
    for selected in evidence.get("ranges",[]):
        yield f"学习范围：{selected['title']} · {selected['label']} · {selected['start_unit']} — {selected['end_unit']}", 10
    if evidence.get("partial"):
        yield "提示：材料较长，本次使用相关文字片段，未覆盖所选范围的全部内容。", 10

    def citations(sources):
        return "来源：" + "；".join(dict.fromkeys(f"{s.get('title','课程材料')} / {s['unit']}" for s in sources))

    def questions(items):
        for index, item in enumerate(items,1):
            yield f"{index}. {item['stem']}", 12
            for letter, option in zip("ABCD",item["options"]):
                yield f"{letter}. {option}", 11
            # Export follows the public artifact: never reveal hidden quiz answers.
            if item.get("sources"):
                yield citations(item["sources"]), 9

    kind = artifact["kind"]
    if kind == "outline":
        yield data["summary"], 11
        for index,item in enumerate(data["items"],1):
            yield f"{index}. {item['term']}（{item['importance']}）", 14
            yield item["explanation"], 11
            yield "主动回忆："+item["recall_question"], 11
            yield citations(item["sources"]), 9
        for item in data["connections"]:
            yield item["chain"], 14
            yield item["explanation"], 11
            yield citations(item["sources"]), 9
    elif kind == "chat":
        if data.get("question"): yield "问题："+data["question"], 12
        yield data["answer"], 11
        yield "继续思考："+data["follow_up"], 11
        yield citations(data["sources"]), 9
    elif kind == "quiz":
        yield "练习版：答案与解析请完成网页作答后查看。", 10
        yield from questions(data["questions"])
    elif kind == "compare":
        yield f"{data['left_name']} 与 {data['right_name']}", 15
        for row in data["rows"]:
            yield row["dimension"], 13
            yield f"{data['left_name']}：{row['left']}\n{data['right_name']}：{row['right']}", 11
            yield citations(row["sources"]), 9
        yield "记忆提示："+data["memory_tip"], 11
        yield from questions(data["practice"])
    elif kind == "feedback":
        yield "已经讲清楚", 14
        for item in data["understood"]: yield item, 11
        for title,key in [("需要修正","corrections"),("还可以补上","missing")]:
            yield title, 14
            for item in data[key]:
                yield "你的说法："+item["student_claim"], 11
                yield item["feedback"], 11
                yield citations(item["sources"]), 9
        yield "下一步："+data["next_question"], 11
    elif kind == "report":
        for item in data["sections"]:
            yield item["title"], 14
            yield item["content"], 11
            yield citations(item["sources"]), 9
        yield "待自行填写："+" / ".join(data["pending"]), 12
        for warning in data["warnings"]: yield warning, 10


def export_pdf(artifact, output: Path):
    font = fitz.Font("cjk")
    document = fitz.open()
    page = writer = None
    y = 0

    def new_page():
        nonlocal page,writer,y
        if writer is not None: writer.write_text(page)
        page = document.new_page(width=595,height=842)
        writer = fitz.TextWriter(page.rect)
        y = 58

    new_page()
    for text,size in blocks(artifact):
        line = ""
        width = 0
        for char in str(text).replace("\r","") + "\n":
            advance = font.text_length(char,fontsize=size) if char != "\n" else 0
            if char == "\n" or width + advance > 495:
                if y + size * 1.6 > 790: new_page()
                if line: writer.append((50,y),line,font=font,fontsize=size)
                y += size * 1.65
                line,width = "",0
                if char == "\n": continue
            line += char
            width += advance
        y += 9
    writer.write_text(page)
    for index,page in enumerate(document,1):
        footer = fitz.TextWriter(page.rect)
        footer.append((50,815),f"小家伙的小家伙 · {index} / {len(document)}",font=font,fontsize=9)
        footer.write_text(page)
    document.set_metadata({"title":artifact["title"],"author":"小家伙的小家伙"})
    document.subset_fonts()
    temporary = output.with_name(uuid4().hex+".pdf")
    try:
        document.save(temporary,garbage=4,deflate=True)
        document.close()
        temporary.replace(output)
    finally:
        if not document.is_closed: document.close()
        temporary.unlink(missing_ok=True)
