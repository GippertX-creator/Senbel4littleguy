"""Build a Windows source-and-guide ZIP; excludes data, virtualenvs and credentials."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
FILES = [".gitattributes", ".gitignore", "README.md", "VALIDATION.md", "requirements.txt", "launch.py", "start.bat", "先看这里.txt"]


def main():
    output = ROOT / "dist" / "小家伙的小家伙-Windows.zip"
    output.parent.mkdir(exist_ok=True)
    included = [ROOT / name for name in FILES if (ROOT / name).is_file()]
    for directory in ["app", "tests", "scripts", "docs"]:
        included.extend(p for p in (ROOT / directory).rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc")
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path in sorted(included):
            archive.write(path, "LittleBuddy/" + path.relative_to(ROOT).as_posix())
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP checksum validation failed")
        assert "LittleBuddy/start.bat" in archive.namelist()
        assert "LittleBuddy/app/static/assets/kitten.png" in archive.namelist()
        assert "LittleBuddy/docs/使用说明书.pdf" in archive.namelist()
        assert "LittleBuddy/docs/media/小家伙的小家伙-操作演示.mp4" in archive.namelist()
        assert not any("/data/" in name or "/.venv/" in name or name.endswith(".env") for name in archive.namelist())
    print(f"Package: {output} ({output.stat().st_size:,} bytes; {len(included)} files)")


if __name__ == "__main__":
    main()
