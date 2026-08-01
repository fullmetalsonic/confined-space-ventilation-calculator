import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "밀폐공간_환기량_산정_도구.html"
DATA = ROOT / "work" / "generated_full_ui_i18n.json"

START = "/* FULL_UI_I18N_START */"
END = "/* FULL_UI_I18N_END */"

packs = json.loads(DATA.read_text(encoding="utf-8"))
block = (
    START + "\n"
    + "const UI_FULL_I18N = "
    + json.dumps(packs, ensure_ascii=False, separators=(",", ":"))
    + ";\n"
    + "function getFullUiText(code=currentUiLanguage){\n"
    + "  return UI_FULL_I18N[code] || UI_FULL_I18N.en;\n"
    + "}\n"
    + END + "\n"
)

text = HTML.read_text(encoding="utf-8")
if START in text and END in text:
    before = text.split(START, 1)[0]
    after = text.split(END, 1)[1].lstrip("\r\n")
    text = before + block + after
else:
    anchor = "function getUiText(code=currentUiLanguage){"
    if anchor not in text:
        raise RuntimeError("insertion anchor not found")
    text = text.replace(anchor, block + anchor, 1)

HTML.write_text(text, encoding="utf-8", newline="")
print(f"injected {len(packs)} packs into {HTML}")
