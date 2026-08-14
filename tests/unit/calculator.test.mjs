import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const RELEASE = new URL("../../docs/index.html", import.meta.url);

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

test("initial screen loads without runtime errors", async () => {
  const { dom, document, errors } = await loadApp();
  assert.match(document.querySelector("h1").textContent, /밀폐공간 환기량 산정/);
  assert.equal(document.querySelectorAll(".choice").length, 3);
  assert.equal(document.querySelectorAll("#stepper li").length, 6);
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
