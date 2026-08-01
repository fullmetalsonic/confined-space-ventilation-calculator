"""프로젝트의 핵심 파일 관계와 기본 구조를 외부 패키지 없이 검증한다."""

from __future__ import annotations

import ast
import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "밀폐공간_환기량_산정_도구.html"
VERSIONED_HTML_PATH = (
    ROOT / "dist" / "html" / "밀폐공간_환기량_산정_도구_v0.3.html"
)
APP_PATH = ROOT / "app.py"
APK_PATH = ROOT / "dist" / "android" / "밀폐공간_환기량_산정_도구_v0.3.apk"
DOCX_PATH = ROOT / "docs" / "밀폐공간_환기량_산정_툴_기획안.docx"


class StructureParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.scripts = 0
        self.styles = 0
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            self.scripts += 1
        elif tag == "style":
            self.styles += 1

        attrs_dict = dict(attrs)
        element_id = attrs_dict.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def embedded_html_from_app(app_text: str) -> bytes:
    match = re.search(
        r"_HTML_B64 = \(\n(?P<body>.*?)\n\)\n\n(?=def get_html\(\):)",
        app_text,
        re.DOTALL,
    )
    if not match:
        raise ValueError("app.py의 _HTML_B64 블록을 찾지 못했습니다.")

    parts: list[str] = []
    for line in match.group("body").splitlines():
        line = line.strip()
        if line:
            value = ast.literal_eval(line)
            if not isinstance(value, str):
                raise ValueError("_HTML_B64 블록에 문자열이 아닌 값이 있습니다.")
            parts.append(value)
    return base64.b64decode("".join(parts), validate=True)


def check_docx() -> tuple[bool, str]:
    if not DOCX_PATH.exists():
        return False, f"기획서 없음: {DOCX_PATH.relative_to(ROOT)}"
    try:
        with zipfile.ZipFile(DOCX_PATH) as archive:
            names = set(archive.namelist())
            if "word/document.xml" not in names:
                return False, "기획서가 유효한 DOCX 구조가 아닙니다."
            xml = archive.read("word/document.xml").decode("utf-8")
    except (OSError, zipfile.BadZipFile) as exc:
        return False, f"기획서 열기 실패: {exc}"

    table_count = xml.count("<w:tbl>")
    stale_note = "5배" in xml
    suffix = ", 초기 5배 문구 있음(과거 기획서)" if stale_note else ""
    return True, f"DOCX 구조 정상, 표 {table_count}개{suffix}"


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    required = [
        HTML_PATH,
        VERSIONED_HTML_PATH,
        APP_PATH,
        ROOT / "assets" / "icon.ico",
        ROOT / "assets" / "app-icon.png",
        ROOT / "docs" / "프로젝트_이력_기록.md",
        ROOT / "PROJECT_STATE.md",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        failures.append("필수 파일 없음: " + ", ".join(missing))

    if failures:
        for item in failures:
            print(f"[FAIL] {item}")
        return 1

    html_bytes = HTML_PATH.read_bytes()
    html_text = html_bytes.decode("utf-8")
    app_text = APP_PATH.read_text(encoding="utf-8")

    versioned_html = VERSIONED_HTML_PATH.read_bytes()
    if versioned_html == html_bytes:
        print(f"[PASS] HTML = v0.3 배포본 ({sha256(versioned_html)})")
    else:
        failures.append("기준 HTML과 v0.3 HTML 배포본이 다릅니다.")

    try:
        compile(app_text, str(APP_PATH), "exec")
        print("[PASS] app.py Python 문법")
    except SyntaxError as exc:
        failures.append(f"app.py 문법 오류: {exc}")

    try:
        embedded = embedded_html_from_app(app_text)
        if embedded == html_bytes:
            print(f"[PASS] HTML = app.py 내장본 ({sha256(html_bytes)})")
        else:
            failures.append(
                "HTML과 app.py 내장본이 다릅니다. "
                "python scripts/sync_desktop_html.py를 실행하세요."
            )
    except Exception as exc:
        failures.append(f"app.py 내장 HTML 검사 실패: {exc}")

    parser = StructureParser()
    parser.feed(html_text)
    if parser.scripts >= 1 and parser.styles >= 1 and not parser.duplicate_ids:
        print(
            f"[PASS] HTML 기본 구조 (script={parser.scripts}, "
            f"style={parser.styles}, id={len(parser.ids)})"
        )
    else:
        failures.append(
            "HTML 구조 이상: "
            f"script={parser.scripts}, style={parser.styles}, "
            f"중복 id={sorted(parser.duplicate_ids)}"
        )

    if APK_PATH.exists():
        try:
            with zipfile.ZipFile(APK_PATH) as archive:
                apk_html = archive.read("assets/index.html")
            if apk_html == html_bytes:
                print(f"[PASS] HTML = APK assets/index.html ({sha256(apk_html)})")
            else:
                warnings.append(
                    "APK 내장 HTML이 기준 원본과 다릅니다. "
                    "Android 원본 프로젝트 복구 전에는 APK를 갱신할 수 없습니다."
                )
        except (OSError, KeyError, zipfile.BadZipFile) as exc:
            failures.append(f"APK 구조 검사 실패: {exc}")
    else:
        warnings.append("APK 파일이 없습니다.")

    docx_ok, docx_message = check_docx()
    print(f"[{'PASS' if docx_ok else 'FAIL'}] {docx_message}")
    if not docx_ok:
        failures.append(docx_message)

    for item in warnings:
        print(f"[WARN] {item}")
    for item in failures:
        print(f"[FAIL] {item}")

    if failures:
        print(f"\n검증 실패 {len(failures)}건, 경고 {len(warnings)}건")
        return 1

    print(f"\n검증 통과, 경고 {len(warnings)}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
