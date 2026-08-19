import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const RELEASE = new URL("../../docs/index.html", import.meta.url);
const SOURCE_CSS = new URL("../../src/styles/app.css", import.meta.url);
const PRINT_CSS = new URL("../../src/styles/v05.css", import.meta.url);

async function loadApp() {
  const html = await readFile(RELEASE, "utf8");
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://test.invalid/",
    virtualConsole,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.print = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { dom, document: dom.window.document, window: dom.window, errors };
}

function setValue(window, element, value) {
  element.value = String(value);
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function setSelect(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

async function waitUntil(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return true;
}

test("initial screen loads without runtime errors", async () => {
  const { dom, document, errors } = await loadApp();
  assert.match(document.querySelector("h1").textContent, /밀폐공간 환기량 산정/);
  assert.match(document.title, /v0\.6$/);
  assert.equal(document.querySelector('meta[property="og:title"]')?.content, "밀폐공간 환기량 산정 · 송배풍기 매칭 도구 — v0.6");
  assert.equal(document.querySelectorAll(".choice").length, 3);
  assert.equal(document.querySelectorAll("#stepper li").length, 6);
  assert.match(document.querySelector('#jurisdiction-profile option[value="kr"]').textContent, /대한민국/);
  assert.equal(document.querySelector("#ui-language").getAttribute("aria-label"), "화면 언어");
  assert.equal(document.querySelector(".credit").textContent.trim(), "Produced by H.S.H");
  assert.equal(document.querySelector('label[for="input-unit-system"]').textContent.trim(), "물리 입력 단위");
  assert.match(document.querySelector('#date-format option[value="locale"]').textContent, /^한국어 · /);
  assert.deepEqual(
    Array.from(document.querySelectorAll("#fan-table thead th"), (cell) => cell.style.width),
    ["14%", "10%", "20%", "10%", "8%", "11%", "9%", "11%", "7%"],
  );
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("volume-exchange calculation produces the required purge and sustained airflow", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("A");
  window.goStep(2);
  const volume = document.querySelector('input[type="number"]');
  setValue(window, volume, 100);
  assert.match(document.querySelector("#volume-result").textContent, /100\.00/);
  window.goStep(3);
  window.computeAndRenderStep4();
  const result = document.querySelector("#result-box").textContent;
  assert.match(result, /1,000\.00/);
  assert.match(result, /2,000\.00/);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("known-generation dilution calculation produces a positive airflow", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("B");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  setValue(window, document.querySelector("#b-w"), 1);
  setValue(window, document.querySelector("#b-m"), 34);
  setValue(window, document.querySelector("#b-tlv"), 10);
  setValue(window, document.querySelector("#b-k"), 2);
  window.computeAndRenderStep4();
  assert.match(document.querySelector("#result-box").textContent, /필요환기량/);
  assert.ok(window.getRequiredQ() > 0);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("measurement-based dilution calculation validates and calculates", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("C");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  setValue(window, document.querySelector("#c-q"), 1000);
  setValue(window, document.querySelector("#c-t"), 30);
  setValue(window, document.querySelector("#c-c0"), 100);
  setValue(window, document.querySelector("#c-ct"), 80);
  setValue(window, document.querySelector("#c-callow"), 10);
  setValue(window, document.querySelector("#c-k"), 2);
  window.computeAndRenderStep4();
  assert.ok(window.getRequiredQ() > 0);
  assert.match(document.querySelector("#result-box").textContent, /역산된 발생 체적유량/);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("language, jurisdiction profile, and unit converter react to user choices", async () => {
  const { dom, document, window, errors } = await loadApp();
  setSelect(window, document.querySelector("#ui-language"), "en");
  assert.match(document.querySelector("h1").textContent, /Confined Space Ventilation/);
  setSelect(window, document.querySelector("#jurisdiction-profile"), "us-general");
  assert.match(document.querySelector("#jurisdiction-profile").selectedOptions[0].textContent, /OSHA/);
  window.toggleConverter();
  setValue(window, document.querySelector("#conv-value"), 100);
  setSelect(window, document.querySelector("#conv-from"), "CFM");
  setSelect(window, document.querySelector("#conv-to"), "CMH");
  window.runConvert();
  assert.match(document.querySelector("#conv-result").textContent, /169\.90/);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("session serialization preserves entered calculation data", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  setValue(window, document.querySelector("#space-name"), "자동검수 공간");
  const session = window.serializeSession();
  assert.equal(session.spaceName, "자동검수 공간");
  assert.equal(session.mode, "A");
  assert.equal(session.zones[0].vals.v, 100);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("all supported space shapes use the documented volume formula", async () => {
  const { dom, window, errors } = await loadApp();
  const cases = [
    [{ shape: "direct", vals: { v: 12 } }, 12],
    [{ shape: "box", vals: { l: 2, w: 3, h: 4 } }, 24],
    [{ shape: "cyl", vals: { r: 2, h: 3 } }, Math.PI * 12],
    [{ shape: "tri", vals: { base: 4, height: 3, depth: 2 } }, 12],
    [{ shape: "frustum", vals: { d1: 2, d2: 4, h: 3 } }, Math.PI * 7],
    [{ shape: "trapezoid", vals: { b1: 2, b2: 4, h: 3, depth: 5 } }, 45],
    [{ shape: "poly", vals: {}, polyPoints: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], polyH: 2 }, 12],
  ];
  for (const [zone, expected] of cases) assert.ok(Math.abs(window.computeZoneVolume(zone) - expected) < 1e-9);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("blower matching, report rendering, and invalid-input blocking work", async () => {
  const { dom, document, window, errors } = await loadApp();
  assert.equal(window.getFanEffective({ flowMethod: "estimate", rated: 1000, eff: 75 }), 750);
  assert.equal(window.getFanEffective({ flowMethod: "measured", appliedFlow: 850 }), 850);
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  window.computeAndRenderStep4();
  window.updateFan(1, "rated", 2000);
  window.updateFan(1, "eff", 100);
  assert.match(document.querySelector("#fan-summary").textContent, /충족/);
  window.renderReport();
  assert.match(document.querySelector("#report-body").textContent, /산정 개요/);
  window.selectMode("B");
  setValue(window, document.querySelector("#b-w"), 0);
  window.goStep(4);
  assert.ok(document.querySelector("#validation-summary").classList.contains("show"));
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("print layout prioritizes one A4 page through four blowers and permits row-level overflow after that", async () => {
  const css = await readFile(PRINT_CSS, "utf8");
  const appCss = await readFile(SOURCE_CSS, "utf8");
  assert.match(css, /\[data-v05-print-layout="one-page"\] \.print-redundant-summary\{display:none;\}/);
  assert.match(css, /\.report-source-table,\s*\n\s*\[data-v05-print-layout\] \.report-equipment-table\{break-inside:auto!important;page-break-inside:auto!important;\}/);
  assert.doesNotMatch(appCss, /translated-signature-table/);

  const { dom, document, window, errors } = await loadApp();
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  window.computeAndRenderStep4();
  window.renderReport();
  window.renderTranslatedReports();
  assert.equal(document.querySelector(".report").dataset.v05PrintLayout, "one-page");
  assert.equal(document.querySelector(".report").dataset.v05FanCount, "1");
  assert.equal(document.querySelectorAll(".print-redundant-summary .kv").length, 3);

  window.addFanRow("송풍기 #2", 500, 75, false);
  window.addFanRow("송풍기 #3", 500, 75, false);
  window.addFanRow("송풍기 #4", 500, 75, false);
  window.renderReport();
  assert.equal(document.querySelector(".report").dataset.v05PrintLayout, "one-page");
  assert.equal(document.querySelector(".report").dataset.v05FanCount, "4");

  window.addFanRow("송풍기 #5", 500, 75, false);
  window.renderReport();
  assert.equal(document.querySelector(".report").dataset.v05PrintLayout, "multi-page");
  assert.equal(document.querySelector(".report").dataset.v05FanCount, "5");
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("language switching preserves supplemental documents and separates UI from document language", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.setUiLanguage("en");
  assert.doesNotMatch(document.querySelector('#jurisdiction-profile option[value="kr"]').textContent, /대한민국/);

  window.setUiLanguage("ko");
  window.setV04SupplementalPrintLanguage("en", true);
  window.setV04SupplementalPrintLanguage("ja", true);
  window.setUiLanguage("de");
  assert.deepEqual(new Set(window.serializeSession().printLanguages), new Set(["en", "ja"]));

  window.setUiLanguage("en");
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  window.computeAndRenderStep4();
  window.renderReport();
  const japanese = document.querySelector('.translated-report[data-language="ja"]');
  assert.ok(japanese, `rendered: ${Array.from(document.querySelectorAll('.translated-report'), section => section.dataset.language).join(',')}`);
  assert.match(japanese.querySelector('.translated-title').textContent, /Japanese.*日本語|日本語.*Japanese/);
  assert.doesNotMatch(japanese.textContent, /PRE-WORK VENTILATION REVIEW/);
  assert.equal(japanese.querySelector('.translated-disclaimer').textContent, window.getUiText('ja')[4]);
  assert.equal(japanese.querySelectorAll('.v05-print-trace > div').length, 4);
  assert.deepEqual(
    Array.from(japanese.querySelectorAll('.v05-print-trace b'), node=>node.textContent),
    ['v0.6',window.V04_UI?.ja?.[0]||'安全基準プロファイル',window.v04Terms('ja')[0],window.PRINT_I18N?.ja?.l?.date||'作成日']
  );
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("supplementary-language choices use the active UI language plus each native name", async () => {
  const { dom, document, window, errors } = await loadApp();
  const languages = Array.from(document.querySelector("#ui-language").options, option => option.value);
  for (const main of languages) {
    window.setUiLanguage(main);
    assert.equal(document.querySelector('.language-options > .hint').textContent, window.getUiText(main)[14]);
    for (const target of languages.filter(code=>code!==main)) {
      const label=document.querySelector(`#print-language-grid input[value="${target}"]`)?.closest('label');
      assert.ok(label, `${main} -> ${target}`);
      const native=window.v04LanguageMeta(target)[2];
      const localized=new Intl.DisplayNames([window.localeV04For(main)],{type:'language'}).of(window.localeV04For(target));
      assert.match(label.textContent, new RegExp(localized.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'), `${main} -> ${target}: localized`);
      if(localized.localeCompare(native,window.localeV04For(main),{sensitivity:'base'})!==0){
        assert.ok(label.textContent.includes(native), `${main} -> ${target}: native`);
      }
    }
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("a foreign primary report can add Korean and a third language without signature fields", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.setUiLanguage("ja");
  window.setJurisdictionProfile("jp");
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  window.computeAndRenderStep4();
  window.setV04SupplementalPrintLanguage("ko", true);
  window.setV04SupplementalPrintLanguage("en", true);
  window.renderReport();
  window.renderTranslatedReports();

  const japanese = document.querySelector('.translated-report[data-language="ja"]');
  const english = document.querySelector('.translated-report[data-language="en"]');
  const korean = document.querySelector('.korean-supplement-report[data-language="ko"]');
  assert.ok(japanese?.classList.contains("primary-translated-report"));
  assert.ok(english);
  assert.ok(korean);
  assert.equal(document.querySelectorAll(".translated-report").length, 2);
  assert.equal(document.querySelectorAll(".korean-supplement-report").length, 1);
  assert.equal(document.querySelectorAll(".sig-table,.translated-signature-table").length, 0);
  for (const report of [japanese, english, korean]) {
    assert.equal(report.querySelectorAll(":scope > .v05-print-trace > div").length, 4);
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("all core screen controls use the active language without stale Korean placeholders", async () => {
  const { dom, document, window, errors } = await loadApp();
  const languages = Array.from(document.querySelector("#ui-language").options, option => option.value);
  for(const language of languages){
    window.setUiLanguage(language);
    const core=window.getUiText(language),profile=window.v04Terms(language);
    assert.equal(document.querySelector('header h1').textContent,core[0],language);
    assert.equal(document.querySelector('.ui-language-label').textContent,`🌐 ${core[2]}`,language);
    assert.equal(JSON.stringify(Array.from(document.querySelectorAll('#stepper li'),item=>item.textContent.replace(/^\d+/,'').trim())),JSON.stringify(core[5]),language);
    assert.ok(document.querySelector('.session-bar .field > label').textContent.trim().startsWith(core[9]),language);
    assert.equal(document.querySelector('.session-actions button').textContent.trim(),core[10],language);
    assert.ok(document.querySelector('.session-actions label.btn').textContent.trim().startsWith(core[11]),language);
    const referenceSummary=document.querySelector('.ref-panel > summary').textContent;
    assert.ok(referenceSummary.includes(profile[3])||referenceSummary.includes(core[12]),language);
    assert.equal(document.querySelector('.language-options > summary').textContent,`🌐 ${core[13]}`,language);
    assert.equal(document.querySelector('.language-options > .hint').textContent,core[14],language);
    assert.equal(document.querySelector('#profile-label').textContent,document.querySelector('#jurisdiction-profile').getAttribute('aria-label'),language);
    assert.notEqual(document.querySelector('label[for="input-unit-system"]').textContent,document.querySelector('label[for="unit-system"]').textContent,language);
    assert.match(document.querySelector('#date-format option[value="locale"]').textContent,/ · /,language);
    if(language!=='ko'){
      assert.doesNotMatch(document.querySelector('#profile-reference').placeholder,/예:/,language);
      assert.doesNotMatch(document.querySelector('#worker-count').placeholder,/예:/,language);
      assert.doesNotMatch(document.querySelector('.session-bar').textContent,/선택|저장된 공간|이 공간/,language);
      assert.doesNotMatch(document.querySelector('#fan-1-name').value,/[가-힣]/,`${language}: starter equipment name`);
    }
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("non-Korean UI states contain no accidental Korean or retired English chrome", async () => {
  const { dom, document, window, errors } = await loadApp();
  const languages = Array.from(document.querySelector("#ui-language").options, option => option.value).filter(code => code !== "ko");
  const retiredChrome = /Recommended document setup|Current settings stay unchanged|Screen language|Legal profile|Review baseline|Restore draft|Delete draft|VENTILATION PLANNING/;

  for (const language of languages) {
    window.setUiLanguage(language);
    window.setJurisdictionProfile("us-general");
    window.selectMode("A");

    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("#ui-language,.language-options,#report-card,script,style").forEach(node => node.remove());
    const attributeText = Array.from(clone.querySelectorAll("*"), element =>
      ["placeholder", "aria-label", "data-label", "title"].map(name => element.getAttribute(name) || "").join(" ") +
      (element.matches("input,textarea") ? ` ${element.value}` : "")
    ).join(" ");
    const visibleUi = `${clone.textContent} ${attributeText}`;

    assert.doesNotMatch(visibleUi, /[가-힣]/, `${language}: accidental Korean UI text`);
    assert.doesNotMatch(visibleUi, retiredChrome, `${language}: retired English UI chrome`);
  }

  assert.deepEqual(errors, []);
  dom.window.close();
});

test("saved sessions restore validated profile, volume, and equipment data", async () => {
  const { dom, document, window, errors } = await loadApp();
  const saved = {
    fileFormat: "confined-space-session", version: 4, mode: "A", spaceName: "복원 검수",
    zones: [{ name: "본체", shape: "box", sign: 1, vals: { l: 2, w: 3, h: 4 }, polyPoints: [], polyH: 0 }],
    fans: [{ name: "실측 송풍기", rated: 500, eff: 75, flowMethod: "measured", appliedFlow: 800, ductDiameter: 300, ductLength: 5, bendCount: 1, staticPressure: 100, advancedNote: "test", explosion: true, qty: 2 }],
    jurisdictionProfile: "us-general", paperSize: "Letter", uiLanguage: "en", unitSystem: "us", printLanguages: ["ko"],
  };
  window.restoreSession(saved);
  const restored = window.serializeSession();
  assert.equal(restored.spaceName, "복원 검수");
  assert.equal(JSON.stringify(restored.zones[0].vals), JSON.stringify({ l: 2, w: 3, h: 4 }));
  assert.equal(restored.fans[0].flowMethod, "measured");
  assert.equal(document.querySelector("#jurisdiction-profile").value, "us-general");
  assert.equal(document.querySelector("#paper-size").value, "Letter");
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("US physical inputs convert to SI storage without changing the calculated volume", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("A");
  window.setV05InputUnits("us");
  window.updateZoneField(1, "v", 3531.4667); // 100 m³ in ft³
  assert.ok(Math.abs(window.serializeSession().zones[0].vals.v - 100) < 0.01);
  assert.match(document.querySelector("#volume-result").textContent, /ft³/);
  window.computeAndRenderStep4();
  assert.ok(Math.abs(window.getRequiredQ() - 2000) < 0.001);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("draft autosave, restore, and delete preserve only device-local session data", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  setValue(window, document.querySelector("#space-name"), "임시저장 검수");
  window.saveV05Draft();
  const raw = window.localStorage.getItem("ventcalc-v05-draft");
  assert.ok(raw);
  assert.equal(JSON.parse(raw).spaceName, "임시저장 검수");
  setValue(window, document.querySelector("#space-name"), "변경됨");
  window.restoreV05Draft();
  assert.equal(window.serializeSession().spaceName, "임시저장 검수");
  window.clearV05Draft();
  assert.equal(window.localStorage.getItem("ventcalc-v05-draft"), null);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("profile recommendations and date format apply their visible document settings", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.setJurisdictionProfile("us-general");
  window.applyV05RegionalRecommendation();
  assert.equal(document.querySelector("#paper-size").value, "Letter");
  assert.equal(document.querySelector("#unit-system").value, "us");
  assert.equal(document.querySelector("#input-unit-system").value, "us");
  window.setV05DateFormat("mdy");
  assert.match(document.querySelector("#date-format-note").textContent, /\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("validation and generated controls remain localized and labelled in every UI language", async () => {
  const { dom, document, window, errors } = await loadApp();
  const languages = Array.from(document.querySelector("#ui-language").options, option => option.value);
  for(const language of languages){
    window.setUiLanguage(language);
    for(const mode of ['A','B','C']){
      window.selectMode(mode);
      window.validateV04Calculation();
      const text=document.querySelector('#validation-summary').textContent;
      assert.ok(text.includes(window.getFullUiText(language).volumeResult),`${language}/${mode}: localized volume`);
      assert.doesNotMatch(text,/0\+/,`${language}/${mode}: stray validation suffix`);
    }
  }

  window.setUiLanguage('de');
  window.selectMode('A');
  const volume=document.querySelector('#zones-list input[data-v05-numeric="true"]');
  setValue(window,volume,'1,5');
  setValue(window,document.querySelector('#a-multiplier'),'1,5');
  setValue(window,document.querySelector('#a-ach'),'1,5');
  assert.equal(window.validateV04Calculation(),true,'comma decimal validation');

  window.setUiLanguage('ja');
  window.addFanRow('検証用',1000,75,false);
  const generatedControls=document.querySelectorAll('#zones-list input,#zones-list select,#fan-tbody input,#fan-tbody select');
  for(const control of generatedControls){
    const labelled=Boolean(control.getAttribute('aria-label')||(control.id&&document.querySelector(`label[for="${control.id}"]`))||control.closest('label'));
    assert.equal(labelled,true,control.outerHTML);
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("translated report output and measurement reliability warnings render without errors", async () => {
  const { dom, document, window, errors } = await loadApp();
  window.selectMode("C");
  setValue(window, document.querySelector('input[type="number"]'), 100);
  setValue(window, document.querySelector("#c-q"), 1000);
  setValue(window, document.querySelector("#c-t"), 1);
  setValue(window, document.querySelector("#c-c0"), 100);
  setValue(window, document.querySelector("#c-ct"), 80);
  setValue(window, document.querySelector("#c-callow"), 10);
  setValue(window, document.querySelector("#c-k"), 2);
  window.computeAndRenderStep4();
  assert.match(document.querySelector("#result-notes").textContent, /신뢰도 낮음/);
  const printLanguages = Array.from(document.querySelectorAll('#print-language-grid input'));
  for (const input of printLanguages) {
    input.checked = true;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  }
  window.renderTranslatedReports();
  assert.equal(document.querySelectorAll(".translated-report").length, printLanguages.length);
  assert.equal(document.querySelectorAll(".sig-table").length, 0);
  assert.ok(document.querySelectorAll(".translated-legal-table").length >= 1);
  for (const report of document.querySelectorAll('.translated-report')) {
    const code=report.dataset.language;
    assert.equal(report.querySelector('.translated-disclaimer').textContent, window.getUiText(code)[4], code);
    assert.match(report.querySelector('.translated-title').textContent, new RegExp(window.v05ProfileLanguageName(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'), code);
    assert.doesNotMatch(report.textContent,/PRE-WORK VENTILATION REVIEW/,code);
    assert.equal(report.querySelectorAll('.v05-print-trace > div').length,4,code);
  }
  for (const table of document.querySelectorAll(".translated-legal-table")) assert.equal(table.lang, "ko");
  window.setJurisdictionProfile("jp");
  window.renderTranslatedReports();
  for (const table of document.querySelectorAll(".translated-legal-table")) assert.equal(table.lang, "ja");
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("invalid session payload is rejected, and hostile text is safely escaped", async () => {
  const { dom, document, window, errors } = await loadApp();
  const rejected = window.sanitizeV04Session({
    fileFormat: "confined-space-session", version: 5, mode: "Z",
    spaceName: "<img src=x onerror=alert(1)>", zones: "not-an-array", fans: [{}],
    jurisdictionProfile: "unknown", paperSize: "A0", uiLanguage: "unknown",
  });
  assert.equal(rejected, null);
  const restored = window.sanitizeV04Session({
    fileFormat: "confined-space-session", version: 5, mode: "Z",
    spaceName: "<img src=x onerror=alert(1)>", zones: [], fans: [{}],
    jurisdictionProfile: "unknown", paperSize: "A0", uiLanguage: "unknown",
  });
  assert.equal(restored.mode, "A");
  assert.equal(restored.jurisdictionProfile, "kr");
  assert.equal(restored.paperSize, "A4");
  window.restoreSession(restored);
  window.renderReport();
  assert.equal(document.querySelectorAll("#report-body img").length, 0);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("file saving and printing select the correct browser, desktop, and Android adapters", async () => {
  const { dom, document, window, errors } = await loadApp();
  const calls = [];
  window.AndroidBridge = {
    print: () => calls.push("android-print"),
    saveFile: (filename, content) => calls.push([filename, content]),
  };
  window.printReport();
  window.downloadOrSave("android.json", "{}", "application/json");
  assert.ok(await waitUntil(() => calls.includes("android-print")));
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(["android.json", "{}"])));
  delete window.AndroidBridge;
  const desktopSaves = [];
  window.pywebview = { api: { save_file: (filename, content) => {
    desktopSaves.push([filename, content]);
    return Promise.resolve(true);
  } } };
  window.downloadOrSave("desktop.json", "{\"desktop\":true}", "application/json");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(desktopSaves, [["desktop.json", "{\"desktop\":true}"]]);
  delete window.pywebview;
  let printCount = 0;
  window.print = () => { printCount += 1; };
  window.printReport();
  assert.ok(await waitUntil(() => printCount === 1));
  assert.equal(printCount, 1);
  const downloads = [];
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = (url) => downloads.push(["revoke", url]);
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push([this.download, this.href]);
  };
  window.downloadOrSave("browser.json", "{\"ok\":true}", "application/json");
  assert.deepEqual(downloads, [["browser.json", "blob:test"], ["revoke", "blob:test"]]);
  window.selectMode("A");
  setValue(window, document.querySelector('input[type="number"]'), 10);
  window.saveSessionToFile();
  assert.match(downloads.at(-2)[0], /^ventcalc_session_space_\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("fan export and validated import update the equipment table", async () => {
  const { dom, document, window, errors } = await loadApp();
  const saved = [];
  window.downloadOrSave = (filename, content, mime) => saved.push({ filename, content, mime });
  window.updateFan(1, "name", "검수 팬");
  window.updateFan(1, "rated", 1200);
  window.exportFans();
  assert.equal(saved[0].filename, "ventcalc_blowers.json");
  assert.match(saved[0].content, /검수 팬/);
  const imported = [{ name: "불러온 팬", rated: 800, eff: 80, qty: 2, flowMethod: "measured", appliedFlow: 700 }];
  class FakeReader {
    readAsText() { this.onload({ target: { result: JSON.stringify(imported) } }); }
  }
  window.FileReader = FakeReader;
  window.importFans({ target: { files: [{}] } });
  assert.equal(window.serializeSession().fans[0].name, "불러온 팬");
  assert.equal(window.serializeSession().fans[0].appliedFlow, 700);
  assert.equal(document.querySelector('#fan-tbody input[type="text"]').value, "불러온 팬");
  assert.deepEqual(errors, []);
  dom.window.close();
});

test("mobile report layout and every language-profile-method state stay renderable", async () => {
  const css = await readFile(SOURCE_CSS, "utf8");
  const printCss = await readFile(PRINT_CSS, "utf8");
  const mobileRules = css.slice(css.lastIndexOf("@media(max-width:720px)"));
  assert.match(mobileRules, /\.permit-checklist\{grid-template-columns:1fr;gap:8px;\}/);
  assert.match(mobileRules, /\.permit-subcheck\{grid-template-columns:1fr;gap:2px;\}/);
  assert.match(mobileRules, /\.report-source-table tbody tr,\.report-source-table td\{height:auto;min-height:0;\}/);
  assert.match(css,/\.stepper\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);overflow:visible/);
  assert.match(css,/@media\(min-width:721px\) and \(max-width:980px\)\{\s*\.global-profile\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\);\}/);
  assert.match(css,/@media\(min-width:721px\) and \(max-width:980px\)\{[\s\S]*?#fan-table thead\{display:none;\}/);
  assert.doesNotMatch(css,/content:"VENTILATION PLANNING"/);
  assert.match(printCss,/:root\[dir="rtl"\] #unit-system[^}]+direction:ltr;text-align:left;unicode-bidi:isolate;/);

  const { dom, document, window, errors } = await loadApp();
  const languages = Array.from(document.querySelector("#ui-language").options, option => option.value);
  const profiles = Array.from(document.querySelector("#jurisdiction-profile").options, option => option.value);
  assert.equal(languages.length, 32);
  assert.equal(profiles.length, 9);

  for (const mode of ["A", "B", "C"]) {
    window.selectMode(mode);
    for (const language of languages) {
      window.setUiLanguage(language);
      assert.equal(document.querySelector('#ui-language').getAttribute('aria-label'),window.getUiText(language)[2],language);
      assert.equal(document.querySelector('.language-options > .hint').textContent,window.getUiText(language)[14],language);
      assert.match(document.querySelector('label[for="date-format"]').textContent,/YYYY\/MM\/DD/,language);
      for (const profile of profiles) {
        window.setJurisdictionProfile(profile);
        assert.equal(document.querySelector('#jurisdiction-profile option:checked').textContent,window.v05ProfileDisplayName(profile,language),`${mode}/${language}/${profile}: profile`);
        for(const link of document.querySelectorAll('#profile-source a'))assert.ok(link.lang,`${mode}/${language}/${profile}: source language`);
        window.renderReport();
        assert.equal(document.querySelectorAll("#report-body .permit-check").length, 4);
        assert.equal(document.querySelectorAll(".sig-table").length, 0);
        assert.equal(document.querySelectorAll('.report > .v05-print-trace > div').length,4,`${mode}/${language}/${profile}: trace`);
        const referenceRows = document.querySelectorAll("#report-body .report-source-table tbody tr");
        assert.ok(referenceRows.length >= 6);
        for (const row of referenceRows) {
          assert.equal(row.cells.length, 2);
          assert.ok(row.cells[0].textContent.trim());
          assert.ok(row.cells[1].textContent.trim());
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});
