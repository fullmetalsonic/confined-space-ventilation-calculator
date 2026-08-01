import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "work" / "generated_full_ui_i18n.json"

# 화면에서 실제로 노출되는 문장을 기능 단위로 관리한다.
# 계산 변수와 단위는 국제 기호를 유지해 번역으로 의미가 바뀌지 않게 한다.
BASE = {
    "step1Sub": "Select the ventilation calculation method appropriate for the confined space.",
    "choiceA_title": "General confined space",
    "choiceA_desc": "Use when no continuous contaminant source is identified, such as a simple oxygen-deficiency concern. Airflow is calculated from space volume and air-change criteria.",
    "choiceB_title": "Known generation rate",
    "choiceB_desc": "Use when a hazardous gas or organic vapor is continuously generated and the hourly usage or generation rate is known.",
    "choiceC_title": "Unknown generation rate",
    "choiceC_desc": "Use when the generation rate is unknown. Estimate it from concentration measurements taken after operating the blower for a set time.",
    "methodNote": "If the appropriate method is uncertain, start with the volume exchange method and adjust it using actual workplace measurement results.",
    "step2Sub": "Add or subtract zones to calculate the effective space volume.",
    "spaceRatio": "Effective air-filled volume",
    "spaceRatioOpt": "Correction factor; default 100%",
    "spaceRatioInfo": "Reduce this value only when pipes or structures occupy a verified portion of the internal volume. Keep 100% if uncertain.",
    "volumeResult": "Calculated effective volume",
    "workerCount": "Number of workers",
    "workerHint": "For record purposes only; this value is not used in the airflow equation.",
    "step3SubA": "Enter the initial purge multiplier and continuous air-change rate.",
    "step3SubB": "Enter material usage and the exposure limit.",
    "step3SubC": "Enter concentration measurements after operating the blower.",
    "aMultiplier": "Initial purge multiplier",
    "aMultiplierOpt": "Minimum criterion",
    "aMultiplierHint": "KOSHA GUIDE H-80-2021 recommends at least 10 space volumes for the initial purge.",
    "aAch": "Continuous air changes",
    "aAchOpt": "Minimum criterion",
    "aAchHint": "Maintain at least 20 air changes per hour while work is in progress. Keep the blower running continuously.",
    "bW": "Hourly material usage or generation W",
    "bWHint": "Actual mass of hazardous material used or generated per hour.",
    "bM": "Molecular weight M",
    "bMHint": "Confirm the molecular weight in the material safety data sheet (MSDS).",
    "bTlv": "Target exposure limit",
    "bTlvHint": "Enter the applicable exposure limit from the MSDS or workplace standard.",
    "bK": "Safety factor K",
    "bKHint": "A reserve factor of about 1.5 to 3 is commonly applied for imperfect mixing.",
    "cQ": "Operating blower airflow Q",
    "cQHint": "Enter the manufacturer operating-point airflow or field-measured airflow.",
    "cT": "Elapsed measurement time",
    "cTHint": "Enter the elapsed minutes from starting ventilation to taking the concentration measurement.",
    "cC0": "Initial concentration C0",
    "cC0Hint": "Concentration measured before starting ventilation.",
    "cCt": "Measured concentration C(t)",
    "cCtHint": "Concentration measured after the entered elapsed time.",
    "cCallow": "Target exposure limit",
    "cCallowHint": "Enter the applicable exposure limit for the substance.",
    "cK": "Safety factor K",
    "cKHint": "A reserve factor applied to the calculated airflow; use 2 if uncertain.",
    "modeBNote": "Uses the ideal-gas molar volume at 25 degrees Celsius and 1 atmosphere to estimate the contaminant generation rate and required dilution airflow.",
    "modeCNote": "Perform this measurement without worker entry, using a remote probe or an extended sampling hose.",
    "step5Sub": "Register available equipment to calculate the quantity required for the airflow determined in step 4.",
    "fanInfo": "Use the manufacturer operating point or a field measurement whenever possible. Record optional duct and pressure conditions. Use explosion-proof equipment where flammable gas or vapor may be present.",
    "correctionInput": "Correction or input",
    "addEquipment": "Add equipment",
    "exportJson": "Export JSON",
    "importJson": "Import JSON",
    "converter": "Airflow unit converter",
    "converterHelp": "Convert equipment specifications such as CFM to cubic metres per hour before entering them above.",
    "value": "Value",
    "fromUnit": "From unit",
    "toUnit": "To unit",
    "convertedValue": "Converted value",
    "step6Sub": "Print or save this report for attachment to the work permit.",
    "delete": "Delete",
    "required": "Required",
    "efficiency": "Efficiency",
    "measured": "Measured",
    "operatingPoint": "Operating point",
    "lowReliability": "Low estimate reliability",
    "adequateTime": "Measurement time adequate",
    "noVolume": "No volume has been entered. Return to step 2 and enter the space volume.",
    "resultA": "Volume exchange calculation result",
    "resultB": "Dilution calculation result for a known generation rate",
    "resultC": "Dilution calculation result estimated from measurements",
    "initialResult": "Initial purge volume — minimum criterion",
    "continuousResult": "Continuous airflow — minimum criterion",
    "generationResult": "Contaminant generation volume flow G",
    "requiredResult": "Required airflow — minimum criterion",
    "optionalDuct": "Optional duct and static-pressure conditions",
    "currentEfficiency": "Current efficiency is used",
    "recordBasis": "Record the airflow basis",
    "ductDiameter": "Duct diameter",
    "ductLength": "Duct length",
    "bendCount": "Number of bends",
    "staticPressure": "Operating static pressure",
    "performanceNote": "Performance or measurement note",
    "noRequired": "Calculate the required airflow in step 4 first.",
    "noEquipment": "No equipment is registered. Add the available blower equipment.",
    "meets": "Meets requirement",
    "reserve": "Reserve margin",
    "shortfall": "Shortfall",
    "saveCancelled": "Saving was cancelled or failed.",
    "saveError": "An error occurred while saving the file.",
    "saveNotReady": "The desktop save function is not ready. Close the app completely, restart it, and try again.",
    "jsonReadError": "The JSON file cannot be read.",
    "invalidSession": "This is not a valid session file.",
    "sessionReadError": "The session file cannot be read. It may be damaged or use an invalid format.",
    "selectMethod": "Select a calculation method in step 1 first.",
    "check1Title": "Measurement and records",
    "check1Desc": "Check O2, CO2, CO, H2S, LEL and task-specific hazards before entry or re-entry.",
    "check2Title": "Isolation and ventilation",
    "check2Desc": "Isolate pipes and energy sources, then maintain continuous ventilation before and during work.",
    "check3Title": "Permit and attendant",
    "check3Desc": "Post required information at the entrance and maintain an outside attendant and communication.",
    "check4Title": "Rescue and evacuation",
    "check4Desc": "Prepare rescue equipment in advance. Do not enter for rescue without respiratory protection.",
    "status": "Status",
    "review": "Review required",
    "role": "Role",
    "name": "Name",
    "signature": "Signature",
}

TARGETS = {
    "en": "en", "zh": "zh-CN", "zht": "zh-TW", "ja": "ja", "vi": "vi",
    "th": "th", "id": "id", "ms": "ms", "hi": "hi", "bn": "bn", "fil": "tl",
    "my": "my", "km": "km", "mn": "mn", "es": "es", "pt": "pt", "ar": "ar",
    "fa": "fa", "ur": "ur", "ru": "ru", "uk": "uk", "pl": "pl", "tr": "tr",
    "de": "de", "fr": "fr", "it": "it", "cs": "cs", "ro": "ro", "hu": "hu",
    "kk": "kk", "uz": "uz",
}

# 번역 서비스가 기술 용어를 영어 그대로 반환한 항목 중 현지어 표현이
# 더 자연스러운 것은 검토 후 명시적으로 덮어쓴다.
MANUAL_OVERRIDES = {
    "id": {"status": "Keadaan"},
    "ms": {"importJson": "Muat masuk JSON", "status": "Keadaan"},
    "fil": {
        "cQ": "Daloy ng hangin ng umaandar na blower Q",
        "converter": "Tagapagpalit ng yunit ng daloy ng hangin",
        "operatingPoint": "Punto ng operasyon",
        "staticPressure": "Statikong presyon sa operasyon",
        "reserve": "Reserbang margin",
    },
    "my": {
        "generationResult": "ညစ်ညမ်းပစ္စည်း ထုတ်လွှတ်မှု ထုထည်စီးနှုန်း G",
    },
    "pt": {"status": "Situação"},
    "de": {"status": "Zustand"},
    "uz": {"status": "Holat"},
}


def translate_chunk(items, target):
    lines = [f"[[[K{i:03d}]]] {text}" for i, (_, text) in enumerate(items)]
    query = "\n".join(lines)
    params = urllib.parse.urlencode({
        "client": "gtx", "sl": "en", "tl": target, "dt": "t", "q": query
    })
    url = "https://translate.googleapis.com/translate_a/single?" + params
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = "".join(part[0] for part in payload[0] if part and part[0])
            found = {
                int(index): value.strip()
                for index, value in re.findall(
                    r"\[\[\[K(\d{3})\]\]\]\s*(.*?)(?=\n?\[\[\[K\d{3}\]\]\]|$)",
                    translated,
                    flags=re.S,
                )
            }
            if len(found) != len(items):
                # 일부 언어는 줄바꿈 과정에서 인접 마커를 합치기도 한다.
                # 누락을 허용하지 않고 이 묶음만 문장별 요청으로 전환한다.
                return {key: translate_single(text, target) for key, text in items}
            return {items[i][0]: found[i] for i in range(len(items))}
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.0 + attempt)


def translate_single(text, target):
    params = urllib.parse.urlencode({
        "client": "gtx", "sl": "en", "tl": target, "dt": "t", "q": text
    })
    url = "https://translate.googleapis.com/translate_a/single?" + params
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                payload = json.loads(response.read().decode("utf-8"))
            value = "".join(part[0] for part in payload[0] if part and part[0]).strip()
            if not value:
                raise RuntimeError("empty translation")
            time.sleep(0.08)
            return value
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.0 + attempt)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        result = json.loads(OUTPUT.read_text(encoding="utf-8"))
    else:
        result = {"en": BASE}
    result["en"] = BASE
    items = list(BASE.items())
    for code, target in TARGETS.items():
        if code == "en" or (code in result and len(result[code]) == len(BASE)):
            continue
        pack = dict(result.get(code, {}))
        missing_items = [(key, value) for key, value in items if key not in pack]
        for start in range(0, len(missing_items), 16):
            chunk = missing_items[start:start + 16]
            pack.update(translate_chunk(chunk, target))
            time.sleep(0.12)
        result[code] = pack
        OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{code}: {len(pack)}", flush=True)
    for code, overrides in MANUAL_OVERRIDES.items():
        result[code].update(overrides)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"written: {OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
