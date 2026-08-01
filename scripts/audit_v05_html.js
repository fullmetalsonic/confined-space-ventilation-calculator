/* v0.5 global-operation regression audit. Run after build_global_v05_html.py. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'dist', 'html', '밀폐공간_환기량_산정_도구_v0.5.html');
const dataPath = path.join(root, 'data', 'regulatory_profiles_v05.json');
const html = fs.readFileSync(htmlPath, 'utf8');
const regulatory = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const failures = [];
const check = (value, message) => { if (!value) failures.push(message); };

check(regulatory.schemaVersion === 1, 'regulatory profile schema is unsupported');
const profiles = regulatory.profiles || {};
check(Object.keys(profiles).length === 9, `expected 9 profiles, found ${Object.keys(profiles).length}`);
for (const [code, profile] of Object.entries(profiles)) {
  for (const key of ['label', 'scope', 'reviewer', 'rows', 'clauses', 'profileVersion', 'approvalStatus', 'approvalNote', 'regionalPreferences']) check(Boolean(profile[key]), `profile ${code} is missing ${key}`);
  for (const key of ['paper', 'resultUnit', 'inputUnit', 'dateFormat']) check(Boolean(profile.regionalPreferences?.[key]), `profile ${code} is missing regional preference ${key}`);
  if (code !== 'unverified') {
    for (const key of ['reviewedAt', 'nextReviewDue', 'url']) check(Boolean(profile[key]), `verified profile ${code} is missing ${key}`);
    check(/^https:\/\//.test(profile.url || ''), `verified profile ${code} does not use an HTTPS official source`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(profile.reviewedAt || '') && /^\d{4}-\d{2}-\d{2}$/.test(profile.nextReviewDue || ''), `verified profile ${code} has an invalid review date`);
    check(profile.nextReviewDue >= profile.reviewedAt, `verified profile ${code} has a review due date before its review baseline`);
  }
}
check(!html.includes('· 2026-07-31 ·'), 'obsolete fixed source-date string remains');
check(html.includes('const V05_REGULATORY_DATA='), 'regulatory data was not injected from the separate file');
check(html.includes('v05-recovery-bar') && html.includes('V05_AUTOSAVE_KEY'), 'draft recovery UI is missing');
check(html.includes('parseV05Number') && html.includes('V05_COMMA_DECIMAL_LANGS'), 'locale decimal parsing is missing');
check(html.includes('input-unit-system') && html.includes('V05_FT_PER_M') && html.includes('V05_CFM_PER_CMH'), 'US physical input conversion is missing');
check(html.includes('date-format') && html.includes('applyV05RegionalRecommendation') && html.includes('v05ProfileVersion'), 'explicit regional recommendation controls or session persistence are missing');
check(html.includes('jp:[\'ja\']') && html.includes('br:[\'pt\']'), 'Japan or Brazil profile-language mapping is missing');
check(html.includes('v05-print-trace'), 'print trace metadata is missing');
check(html.includes('data-v05-print-density="compact"') && html.includes("container.dataset.v05PrintDensity='compact'"), 'universal compact print layout is missing');
check(html.includes('unhandledrejection') && html.includes('v05RuntimeRecovery'), 'runtime recovery handling is missing');
check(html.includes(':root[dir="rtl"]') && html.includes('unicode-bidi:isolate'), 'RTL numeric isolation is missing');
check(/\.step\{display:none;\}/.test(html) && /\.step\[data-step="1"\]\{display:block;\}/.test(html), 'progressive step visibility fallback is missing');
check(/el\.style\.display = \(parseInt\(el\.dataset\.step\)===n\) \? 'block' : 'none';/.test(html), 'workflow step isolation is missing');
check(html.includes("if(currentUiLanguage!=='ko')result.push(currentUiLanguage);"), 'screen language is not promoted to the primary print language');
check(html.includes("document.querySelectorAll('.translated-report,.korean-supplement-report')"), 'Korean supplementary report is missing v0.5 print trace processing');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(duplicates.length === 0, `duplicate IDs: ${duplicates.join(', ')}`);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
check(scripts.length === 2, `expected two script blocks, found ${scripts.length}`);

if (scripts.length === 2) {
  const code = `${scripts.join('\n')}\nglobalThis.__audit={state,V04_PROFILES,V05_REGULATORY_DATA,UI_LANGUAGE_META,parseV05Number,setV05InputUnits,updateZoneField,updateFan,saveV05Draft,v05AddTrace,getSelectedPrintLanguages,setJurisdictionProfile,applyV05RegionalRecommendation,serializeSession};globalThis.__parseComma=()=>{const prior=currentUiLanguage;currentUiLanguage='fr';const value=parseV05Number('1,5');currentUiLanguage=prior;return value;};globalThis.__setAuditLanguage=code=>{currentUiLanguage=code;};globalThis.__getAuditSettings=()=>({paper:v04Paper,resultUnit:v04UnitSystem,inputUnit:v05InputUnits,dateFormat:v05DateFormat,jurisdiction:v04Jurisdiction});`;
  const listeners = [], storage = new Map(), noop = () => {};
  const node = () => ({
    style: {}, dataset: {}, childNodes: [], value: '', textContent: '', innerHTML: '', checked: false, hidden: false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, appendChild: noop, prepend: noop, insertAdjacentHTML: noop, removeChild: noop, remove: noop,
    setAttribute: noop, removeAttribute: noop, querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    matches: () => false, getBoundingClientRect: () => ({ top: 0 }), click: noop, focus: noop,
  });
  const nodes = new Map();
  const steps = [1, 2, 3, 4, 5, 6].map(step => Object.assign(node(), { dataset: { step: String(step) } }));
  const reportNode = node();
  const document = {
    documentElement: { lang: '', dir: '', dataset: {} },
    addEventListener: (type, fn) => { if (type === 'DOMContentLoaded') listeners.push(fn); },
    getElementById: id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
    querySelector: selector => selector === 'details.ref-panel' ? null : selector === '.report' ? reportNode : node(),
    querySelectorAll: selector => selector === '.step' ? steps : [], createElement: node,
    createTextNode: text => ({ nodeType: 3, textContent: text }), createTreeWalker: () => ({ nextNode: () => false }),
    body: { appendChild: noop, removeChild: noop }, head: { appendChild: noop },
  };
  const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const context = {
    console, document, localStorage, NodeFilter: { SHOW_TEXT: 4 },
    window: { scrollY: 0, localStorage, addEventListener: noop, matchMedia: () => ({ matches: false }), scrollTo: noop, print: noop },
    setTimeout: fn => { fn(); return 0; }, clearTimeout: noop, requestAnimationFrame: fn => { fn(); return 0; }, alert: noop,
    FileReader: function FileReader() {}, Blob: function Blob() {}, URL: { createObjectURL: () => '', revokeObjectURL: noop },
    Intl, JSON, Math, Number, String, Object, Array, Set, Date, RegExp, Error, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
  };
  try {
    vm.createContext(context); vm.runInContext(code, context, { timeout: 5000 }); listeners.forEach(listener => listener());
    const app = context.__audit;
    check(app.state.step === 1 && app.state.zones.length === 1 && app.state.fans.length === 1, 'initial step or default editable rows failed');
    check(app.state.fans[0].qty === 1, 'default blower planned quantity must be 1');
    check(Object.keys(app.V04_PROFILES).length === 9, 'runtime regulatory profile count is wrong');
    check(context.__parseComma() === 1.5, 'comma decimal 1,5 was not parsed as 1.5');
    app.state.zones[0].vals.v = 0; app.setV05InputUnits('us', true); app.updateZoneField(app.state.zones[0].id, 'v', '35.3146667');
    check(Math.abs(app.state.zones[0].vals.v - 1) < 0.0001, 'ft³ input was not converted to internal m³');
    app.updateFan(app.state.fans[0].id, 'rated', '353.146667');
    check(Math.abs(app.state.fans[0].rated - 600) < 0.001, 'CFM blower input was not converted to internal m³/h');
    app.v05AddTrace(reportNode);
    check(reportNode.dataset.v05PrintDensity === 'compact', 'one-blower compact print layout was not applied immediately before printing');
    app.state.fans.push({...app.state.fans[0], id: 999}, {...app.state.fans[0], id: 1000}); app.v05AddTrace(reportNode);
    check(reportNode.dataset.v05PrintDensity === 'compact', 'three-blower compact print layout was not retained immediately before printing');
    const beforeRecommendation = context.__getAuditSettings(); app.setJurisdictionProfile('us-general');
    const afterProfileChange = context.__getAuditSettings();
    check(afterProfileChange.paper === beforeRecommendation.paper && afterProfileChange.resultUnit === beforeRecommendation.resultUnit && afterProfileChange.inputUnit === beforeRecommendation.inputUnit, 'profile change altered regional settings without confirmation');
    app.applyV05RegionalRecommendation();
    const afterRecommendation = context.__getAuditSettings();
    check(afterRecommendation.paper === 'Letter' && afterRecommendation.resultUnit === 'us' && afterRecommendation.inputUnit === 'us' && afterRecommendation.dateFormat === 'mdy', 'US regional recommendation was not applied');
    const savedSession = app.serializeSession();
    check(savedSession.version === 5 && savedSession.v05InputUnit === 'us' && savedSession.v05DateFormat === 'mdy' && savedSession.v05ProfileVersion === '1.0', 'regional recommendation was not preserved in the session file');
    context.__setAuditLanguage('th');
    check(app.getSelectedPrintLanguages().join(',') === 'th', 'screen language was not used as the primary print language');
    app.saveV05Draft(); check(storage.has('ventcalc-v05-draft'), 'device-local draft was not saved');
  } catch (error) { failures.push(`runtime audit failed: ${error.message}`); }
}

if (failures.length) { console.error('v0.5 audit failed:'); failures.forEach(item => console.error(`- ${item}`)); process.exit(1); }
console.log(`v0.5 audit passed: ${path.basename(htmlPath)}; ${ids.length} IDs; ${Object.keys(profiles).length} regulatory profiles.`);
