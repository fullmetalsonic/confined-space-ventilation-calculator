"""기준 HTML을 app.py의 Base64 내장본에 반영한다."""

from __future__ import annotations

import base64
import argparse
from pathlib import Path
import re
import textwrap


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HTML_PATH = ROOT / "dist" / "html" / "밀폐공간_환기량_산정_도구_v0.6.html"
DEFAULT_APP_PATH = ROOT / "app.py"

BLOCK_PATTERN = re.compile(
    r"_HTML_B64 = \(\n.*?\n\)\n\n(?=def get_html\(\):)",
    re.DOTALL,
)


def build_block(html_bytes: bytes) -> str:
    encoded = base64.b64encode(html_bytes).decode("ascii")
    lines = textwrap.wrap(encoded, width=100)
    quoted = "\n".join(f'    "{line}"' for line in lines)
    return f"_HTML_B64 = (\n{quoted}\n)\n\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed a selected HTML release into an app.py copy.")
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML_PATH, help="HTML release to embed")
    parser.add_argument("--app", type=Path, default=DEFAULT_APP_PATH, help="app.py target to update")
    args = parser.parse_args()
    html_path = args.html.resolve()
    app_path = args.app.resolve()
    if not html_path.is_file():
        raise RuntimeError(f"HTML 파일을 찾지 못했습니다: {html_path}")
    if not app_path.is_file():
        raise RuntimeError(f"app.py 파일을 찾지 못했습니다: {app_path}")
    html_bytes = html_path.read_bytes()
    app_text = app_path.read_text(encoding="utf-8")
    replacement = build_block(html_bytes)
    updated, count = BLOCK_PATTERN.subn(replacement, app_text, count=1)
    if count != 1:
        raise RuntimeError("app.py에서 _HTML_B64 블록을 정확히 하나 찾지 못했습니다.")

    app_path.write_text(updated, encoding="utf-8", newline="\n")
    print(f"동기화 완료: {html_path.name} -> {app_path.name} ({len(html_bytes):,} bytes)")


if __name__ == "__main__":
    main()
