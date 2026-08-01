/*
  v0.4 regression audit
  Run after build_global_v04_html.py:
    node scripts/audit_v04_html.js
  No external packages or browser are required.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'dist', 'html', '밀폐공간_환기량_산정_도구_v0.4.html');
const html = fs.readFileSync(file, 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// Structural checks that catch broken generation before the file is handed off.
check(/<meta\s+name="viewport"/i.test(html), 'mobile viewport meta tag is missing');
check(/@media print/.test(html) && /@page\s*\{/.test(html), 'print stylesheet is incomplete');
check(/break-inside:avoid/.test(html), 'print row/card split protection is missing');
check(/@media\s*\(max-width/.test(html), 'mobile breakpoint is missing');
check(/safeV04StorageGet/.test(html) && /safeV04StorageSet/.test(html), 'safe storage guard is missing');
check(/escapeV04\(z\.name\|\|''\)/.test(html), 'zone-name HTML escaping is missing');
check(/escapeV04\(f\.name\)/.test(html), 'fan-name HTML escaping is missing');
check(/const methods=V04_FAN_METHODS\[currentUiLanguage\]/.test(html), 'flow-method UI language binding is missing');
check(!/v04RenderResult|ensureV04StarterRows/.test(html), 'removed initialization workaround remains');
check(['삭제', '장비 추가', '선택 입력 · 덕트·정압 조건'].every(text => html.includes(text)), 'Korean interactive UI text is missing');
check(html.includes('let v04InitialStepScroll = true;') && html.includes("window.scrollTo({top:0,behavior:'auto'});"), 'initial launch top-of-page rule is missing');
check(html.includes("section.className='report korean-supplement-report';"), 'Korean supplementary report is incorrectly using translated-report layout');
check(html.includes("#report-body,.translated-report,.korean-supplement-report"), 'Korean supplementary report is missing print metadata');
check(/\.korean-supplement-report\{\s*page-break-before:always!important;break-before:page!important;/.test(html), 'Korean supplementary report page separation is missing');
check(html.includes('.korean-supplement-report .print-overview-item'), 'Korean supplementary overview still uses native boxed cards');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(duplicates.length === 0, `duplicate IDs: ${duplicates.join(', ')}`);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
check(scripts.length === 1, `expected one embedded script, found ${scripts.length}`);

if (scripts.length === 1) {
  const code = `${scripts[0]}\nglobalThis.__audit={state,V04_FAN_METHODS,UI_LANGUAGE_META,UI_FULL_I18N,sanitizeV04Session,getFanEffective,updateFan,updateZoneField};`;
  const listeners = [];
  const noop = () => {};
  const makeNode = () => ({
    style: {}, dataset: {}, childNodes: [], value: '', textContent: '', innerHTML: '', checked: false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, appendChild: noop, prepend: noop, removeChild: noop,
    setAttribute: noop, removeAttribute: noop, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, getBoundingClientRect: () => ({ top: 0 }), click: noop, focus: noop,
  });
  const nodes = new Map();
  const steps = [1, 2, 3, 4, 5, 6].map(step => Object.assign(makeNode(), { dataset: { step: String(step) } }));
  const document = {
    documentElement: { lang: '', dir: '', dataset: {} },
    addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') listeners.push(fn); },
    getElementById: id => { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); },
    querySelector: selector => selector === 'details.ref-panel' ? null : makeNode(),
    querySelectorAll: selector => selector === '.step' ? steps : [],
    createElement: makeNode,
    createTextNode: text => ({ nodeType: 3, textContent: text }),
    createTreeWalker: () => ({ nextNode: () => false }),
    body: { appendChild: noop, removeChild: noop },
  };
  const scrollCalls = [];
  const context = {
    console, document, NodeFilter: { SHOW_TEXT: 4 },
    window: { scrollY: 0, addEventListener: noop, matchMedia: () => ({ matches: false }), scrollTo: options => scrollCalls.push(options), print: noop },
    localStorage: { getItem: () => null, setItem: noop }, setTimeout: fn => { fn(); return 0; },
    clearTimeout: noop, requestAnimationFrame: fn => { fn(); return 0; }, alert: noop,
    FileReader: function FileReader() {}, Blob: function Blob() {},
    URL: { createObjectURL: () => '', revokeObjectURL: noop },
    Intl, JSON, Math, Number, String, Object, Array, Set, Date, RegExp, Error,
    parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
  };
  try {
    vm.createContext(context);
    vm.runInContext(code, context, { timeout: 3000 });
    listeners.forEach(listener => listener());
    const app = context.__audit;
    check(app.state.step === 1, `initial step must be 1, received ${app.state.step}`);
    check(scrollCalls.length === 1 && scrollCalls[0].top === 0 && scrollCalls[0].behavior === 'auto', 'initial launch must remain at the page top');
    check(app.state.zones.length === 1, `initial zones must be 1, received ${app.state.zones.length}`);
    check(app.state.fans.length === 1, `initial fans must be 1, received ${app.state.fans.length}`);
    check(app.getFanEffective(app.state.fans[0]) === 375, 'default blower effective airflow must be 375 m³/h');
    check(app.state.fans[0].qty === 1, 'default blower planned quantity must be 1');
    check(app.UI_LANGUAGE_META.length === 32, `expected 32 UI languages, found ${app.UI_LANGUAGE_META.length}`);
    check(Object.keys(app.V04_FAN_METHODS).length === app.UI_LANGUAGE_META.length, 'flow-method translations do not cover every UI language');
    check(Object.values(app.V04_FAN_METHODS).every(methods => ['estimate', 'manufacturer', 'measured'].every(key => typeof methods[key] === 'string' && methods[key].trim())), 'incomplete flow-method translation');
    const requiredUiTerms = ['delete', 'addEquipment', 'step5Sub', 'fanInfo', 'optionalDuct', 'noEquipment'];
    const missingUiTerms = app.UI_LANGUAGE_META.filter(([code]) => code !== 'ko').flatMap(([code]) => requiredUiTerms
      .filter(key => typeof app.UI_FULL_I18N[code]?.[key] !== 'string' || !app.UI_FULL_I18N[code][key].trim())
      .map(key => `${code}.${key}`));
    check(missingUiTerms.length === 0, `missing interactive UI translations: ${missingUiTerms.join(', ')}`);
    app.updateFan(app.state.fans[0].id, 'rated', '-1');
    check(app.state.fans[0].rated === 0, 'negative rated airflow was not normalized to zero');
    app.updateZoneField(app.state.zones[0].id, 'v', '-1');
    check(app.state.zones[0].vals.v === 0, 'negative direct volume was not normalized to zero');
    check(app.sanitizeV04Session({ fileFormat: 'confined-space-session', version: 4, zones: 'not-an-array' }) === null, 'invalid session shape was accepted');
  } catch (error) {
    failures.push(`runtime initialization failed: ${error.message}`);
  }
}

if (failures.length) {
  console.error('v0.4 audit failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`v0.4 audit passed: ${path.basename(file)}; ${ids.length} IDs checked; 32 UI languages checked.`);
