import re
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.shared import Pt
from docx.text.paragraph import Paragraph

FIELDS = {
    "title": "实验名称", "purpose": "实验目的", "principle": "实验原理",
    "equipment": "仪器与试剂", "steps": "实验步骤", "precautions": "注意事项",
    "data": "实验数据", "results": "实验结果", "discussion": "分析与讨论", "conclusion": "实验结论",
}
BLANKS = {
    "data": "[请填写真实实验数据、单位与观察现象]",
    "results": "[请根据实际数据整理结果，不预生成结果]",
    "discussion": "[结合真实结果讨论原理、误差来源及改进方法]",
    "conclusion": "[根据真实结果填写结论]",
}
ALIASES = {
    "实验目的": "purpose", "目的": "purpose", "实验原理": "principle", "原理": "principle",
    "仪器与试剂": "equipment", "实验器材": "equipment", "材料与方法": "equipment", "仪器和试剂": "equipment",
    "实验步骤": "steps", "实验方法": "steps", "操作步骤": "steps", "方法与步骤": "steps",
    "注意事项": "precautions", "实验数据": "data", "数据记录": "data",
    "实验结果": "results", "结果": "results", "分析与讨论": "discussion", "讨论": "discussion",
    "结果分析": "discussion", "实验结论": "conclusion", "结论": "conclusion",
}


def paragraphs(doc):
    yield from doc.paragraphs

    def in_table(table):
        seen = set()
        for row in table.rows:
            for cell in row.cells:
                if id(cell._tc) in seen:
                    continue
                seen.add(id(cell._tc))
                yield from cell.paragraphs
                for nested in cell.tables:
                    yield from in_table(nested)
    for table in doc.tables:
        yield from in_table(table)


def replace_tokens(paragraph, fields):
    # Replace across split Word runs while preserving unaffected run formatting.
    tokens = {"{{" + alias + "}}": fields[key] for key, label in FIELDS.items() for alias in (label, key)}
    for token, value in tokens.items():
        while token in paragraph.text:
            start = paragraph.text.index(token)
            end = start + len(token)
            offset, involved = 0, []
            for run in paragraph.runs:
                next_offset = offset + len(run.text)
                if next_offset > start and offset < end:
                    involved.append((run, offset))
                offset = next_offset
            if not involved:
                break
            first, first_offset = involved[0]
            last, last_offset = involved[-1]
            prefix = first.text[:start - first_offset]
            suffix = last.text[end - last_offset:]
            first.text = prefix + value + suffix
            for run, _ in involved[1:]:
                run.text = ""


def heading_key(text):
    clean = re.sub(r"^[\s一二三四五六七八九十\d、.．:：()（）\-]+", "", text).rstrip("：: \n")
    return ALIASES.get(clean)


def after(paragraph, text):
    element = OxmlElement("w:p")
    paragraph._p.addnext(element)
    created = Paragraph(element, paragraph._parent)
    created.add_run(text)
    return created


def export_report(data, output: Path, template: Path | None = None):
    fields = {s["key"]: s["content"] for s in data["sections"]}
    fields.update(BLANKS)
    fields["title"] = data["title"]
    warnings, used = [], set()
    if template and template.suffix == ".docx":
        doc = Document(template)
        for paragraph in list(paragraphs(doc)):
            for key, label in FIELDS.items():
                if "{{" + label + "}}" in paragraph.text or "{{" + key + "}}" in paragraph.text:
                    used.add(key)
            replace_tokens(paragraph, fields)
        if not used:
            # Only populate clearly recognised section headings. Preserve tables and template layout.
            body_paragraphs = list(doc.paragraphs)
            matches = [(i, heading_key(p.text)) for i, p in enumerate(body_paragraphs) if heading_key(p.text)]
            for n, (index, key) in enumerate(matches):
                header = body_paragraphs[index]
                next_index = matches[n + 1][0] if n + 1 < len(matches) else len(body_paragraphs)
                # Clearing existing section prose prevents a sample result from being presented as real.
                for old in body_paragraphs[index + 1:next_index]:
                    if old._p.getparent() is not None:
                        old._p.getparent().remove(old._p)
                after(header, fields[key])
                used.add(key)
            if matches:
                warnings.append("已按识别到的章节标题填写。模板中的表格、页眉页脚保留，请检查是否含示例数据；占位符模板的匹配更可靠。")
        if not used:
            warnings.append("模板未包含支持的占位符或章节标题，已按标准结构导出；原模板未修改。")
            doc = Document()
        else:
            warnings.append("已保留模板版式；请检查换页、表格空间和学校格式要求。")
    else:
        doc = Document()
        if template:
            warnings.append("非 DOCX 模板用于理解结构，无法完整保留原版式；已导出标准 Word 报告。")
    if not used:
        doc.add_heading(data["title"], 0)
        doc.add_paragraph("姓名：____________    学号：____________    日期：____________")
    for key, label in FIELDS.items():
        if key == "title" or key in used:
            continue
        doc.add_heading(label, 1)
        doc.add_paragraph(fields[key])
    doc.add_heading("材料来源（提交前可按课程要求调整）", 1)
    for section in data["sections"]:
        citations = "；".join(f"{s.get('title', s['material_id'])} · {s['unit']}" for s in section["sources"])
        doc.add_paragraph(f"{section['title']}：{citations}")
    if not template or not used:
        style = doc.styles["Normal"]
        style.font.name = "Microsoft YaHei"
        style.font.size = Pt(10.5)
        style._element.rPr.rFonts.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia", "微软雅黑")
    doc.save(output)
    return warnings
