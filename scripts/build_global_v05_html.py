from pathlib import Path
import json
import runpy


ROOT = Path(__file__).resolve().parents[1]
V04_BUILDER = ROOT / "scripts" / "build_global_v04_html.py"
V04_OUTPUT = ROOT / "dist" / "html" / "밀폐공간_환기량_산정_도구_v0.4.html"
OUTPUT = ROOT / "dist" / "html" / "밀폐공간_환기량_산정_도구_v0.5.html"
REGULATORY_DATA = ROOT / "data" / "regulatory_profiles_v05.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


# v0.5 builds on the verified v0.4 output, then layers only global-operation features.
runpy.run_path(str(V04_BUILDER))
profiles_document = json.loads(REGULATORY_DATA.read_text(encoding="utf-8"))
if profiles_document.get("schemaVersion") != 1 or not profiles_document.get("profiles"):
    raise RuntimeError("regulatory profile data is missing or has an unsupported schema")

html = V04_OUTPUT.read_text(encoding="utf-8").replace("v0.4", "v0.5")
html = html.replace(
    "· 2026-07-31 · ${escapeV04(terms[4])}",
    "· ${escapeV04(p.reviewedAt||'—')} · ${escapeV04(terms[4])}",
)
profile_json = json.dumps(profiles_document, ensure_ascii=False, separators=(",", ":"))

start = html.index("const V04_PROFILES = {")
end = html.index("const V04_UI = {", start)
html = html[:start] + (
    f"const V05_REGULATORY_DATA={profile_json};\n"
    "const V04_PROFILES=V05_REGULATORY_DATA.profiles;\n\n"
) + html[end:]

start = html.index("const V04_LEGAL_DATA = {")
end = html.index("function escapeV04", start)
html = html[:start] + (
    "const V04_LEGAL_DATA=Object.fromEntries(Object.entries(V05_REGULATORY_DATA.profiles)"
    ".map(([code,profile])=>[code,{rows:profile.rows||[],clauses:profile.clauses||''}]));\n\n"
) + html[end:]

extension = r'''
<style id="global-v05-operations">
  .global-profile .profile-source{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:stretch;}
  .v05-profile-governance,.v05-recovery-bar,.v05-runtime-notice{border:1px solid #b9d9e8;border-radius:12px;background:#f5fbff;padding:10px 12px;margin:0;font-size:12px;line-height:1.5;}
  .v05-profile-governance dl{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content minmax(0,1.25fr);gap:4px 12px;margin:0;}
  .v05-profile-governance dt{font-weight:800;color:#075985;}.v05-profile-governance dd{margin:0;overflow-wrap:anywhere;}
  .v05-profile-warning,.v05-runtime-notice{border-color:#edc36c;background:#fff9e8;color:#6b4d00;font-weight:700;}
  .v05-regional-preference{border:1px solid #9bcfe5;border-left:4px solid #1686b4;border-radius:10px;background:linear-gradient(90deg,#f4fbff,#e8f7ff);padding:10px 12px;display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:12px;align-items:center;}
  .v05-regional-heading b{display:block;color:#075985;font-size:12px;}.v05-regional-heading small{display:block;margin-top:2px;color:#59717e;line-height:1.35;}
  .v05-regional-values{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}.v05-regional-values span{display:grid;gap:1px;min-width:72px;padding:4px 7px;border:1px solid #c8e1ee;border-radius:7px;background:#fff;text-align:center;}.v05-regional-values em{font-style:normal;font-size:9px;color:#5f7d8b;}.v05-regional-values b{color:#075985;font-size:11px;white-space:nowrap;}
  .v05-regional-preference button{min-height:34px;padding:6px 11px;font:inherit;font-size:12px;font-weight:800;border:1px solid #2587b2;border-radius:8px;background:#087daf;color:#fff;cursor:pointer;white-space:nowrap;}
  .v05-recovery-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}.v05-recovery-bar .status{font-weight:700;color:#075985;}.v05-recovery-bar .muted{color:#59717e;}
  .v05-recovery-bar button{padding:6px 10px;font:inherit;font-weight:800;border:1px solid #8bbcd2;border-radius:8px;background:#fff;color:#075985;cursor:pointer;}
  .v05-print-trace{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border:1px solid #c9dce5;border-radius:8px;overflow:hidden;margin:10px 0;font-size:10px;break-inside:avoid;page-break-inside:avoid;}
  .v05-print-trace div{padding:5px 7px;border-right:1px solid #d7e5eb;border-bottom:1px solid #d7e5eb;overflow-wrap:anywhere;}.v05-print-trace b{display:block;color:#075985;font-size:8px;text-transform:uppercase;letter-spacing:.03em;}
  :root[dir="rtl"] .metric .value,:root[dir="rtl"] .unit,:root[dir="rtl"] .v05-ltr,:root[dir="rtl"] time,:root[dir="rtl"] input[type="number"],:root[dir="rtl"] input[inputmode="decimal"]{direction:ltr;unicode-bidi:isolate;}
  :root[dir="rtl"] .v05-print-trace{direction:rtl;}:root[dir="rtl"] .v05-print-trace .v05-ltr{direction:ltr;text-align:left;}
  @media (max-width:720px){.v05-profile-governance dl{grid-template-columns:max-content minmax(0,1fr);gap:3px 9px;}.v05-regional-preference{grid-template-columns:1fr;gap:8px;}.v05-regional-values{justify-content:flex-start;}.v05-regional-preference button{width:100%;}.v05-print-trace{grid-template-columns:1fr 1fr;}.v05-recovery-bar{align-items:stretch;}.v05-recovery-bar button{min-height:40px;}}
  @media print{
    .v05-recovery-bar,.v05-runtime-notice{display:none!important;}.v05-print-trace{font-size:8.5px;}.v05-print-trace div{padding:4px 5px;}
    /* Compact print layout is the default: blower count must not create an avoidable second page. */
    .report[data-v05-print-density="compact"],.translated-report[data-v05-print-density="compact"]{font-size:96%;}
    [data-v05-print-density="compact"] .v05-print-trace{display:block;margin:3px 0;padding:2px 4px;font-size:6.5px;line-height:1.15;}
    [data-v05-print-density="compact"] .v05-print-trace div{display:inline;border:0;padding:0;margin:0 5px 0 0;}
    [data-v05-print-density="compact"] .v05-print-trace b{display:inline;margin-right:1px;font-size:5.8px;}
    [data-v05-print-density="compact"] .permit-check{min-height:56px;padding:3px 4px;font-size:6.8px;line-height:1.12;}
    [data-v05-print-density="compact"] .permit-check-title b{font-size:7.2px;}
    [data-v05-print-density="compact"] .permit-subcheck{padding:1px 0;}
    [data-v05-print-density="compact"] .report-source-table tbody tr,[data-v05-print-density="compact"] .report-source-table td{height:20px!important;}
    [data-v05-print-density="compact"] .report table.sig-table tbody tr,[data-v05-print-density="compact"] .report table.sig-table tbody td{height:27px!important;line-height:27px;}
    [data-v05-print-density="compact"] .report-tail{break-inside:auto;page-break-inside:auto;}
    [data-v05-print-density="compact"] .sig-table{break-inside:avoid;page-break-inside:avoid;}
  }
</style>
<script>
/* ============================================================
   v0.5 GLOBAL OPERATIONS EXTENSION
   Internal calculation and stored data remain SI.
============================================================ */
const V05_VERSION='v0.5';
const V05_AUTOSAVE_KEY='ventcalc-v05-draft';
const V05_COMMA_DECIMAL_LANGS=new Set(['fr','de','pt','es','it','ro','hu','pl','tr','cs','ru','uk','kk','uz']);
const V05_PROFILE_LANGUAGES={kr:['ko'],'us-general':['en','es'],'us-construction':['en','es'],uk:['en'],au:['en'],sg:['en','zh','zht','ms'],jp:['ja'],br:['pt'],unverified:[]};
const V05_FT_PER_M=3.280839895;
const V05_CFM_PER_CMH=0.588577779;
let v05InputUnits='si';
let v05InputUnitsTouched=false;
/* The default profile is Korea, so show its explicit YYYY.MM.DD convention from first launch. */
let v05DateFormat='ymd';
let v05DraftTimer=0;
let v05LastDraftAt='';

function v05IsKorean(){return currentUiLanguage==='ko';}
function v05Text(ko,en){return v05IsKorean()?ko:en;}
function v05ProfilePreferences(p=v05Profile()){return {paper:p?.regionalPreferences?.paper==='Letter'?'Letter':'A4',resultUnit:p?.regionalPreferences?.resultUnit==='us'?'us':'si',inputUnit:p?.regionalPreferences?.inputUnit==='us'?'us':'si',dateFormat:['locale','ymd','dmy','mdy'].includes(p?.regionalPreferences?.dateFormat)?p.regionalPreferences.dateFormat:'locale'};}
function v05ApprovalText(p=v05Profile()){
  return p?.approvalStatus==='local-ehs-approved'
    ?v05Text('현지 EHS 승인 완료','Local EHS approved')
    :p?.approvalStatus==='unverified'
      ?v05Text('현지 법규·EHS 승인 미검증','Local law and EHS approval unverified')
      :v05Text('공식 출처 검토 완료 · 현지 EHS 승인 대기','Official source reviewed · local EHS approval pending');
}
function v05FormatDate(date,code=currentUiLanguage){
  const d=date instanceof Date?date:new Date(date);if(Number.isNaN(d.getTime()))return '—';
  if(v05DateFormat==='locale')return v05BaseFormatDateFor(code,d);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return v05DateFormat==='mdy'?`${m}/${day}/${y}`:v05DateFormat==='dmy'?`${day}/${m}/${y}`:`${y}.${m}.${day}`;
}
const v05BaseFormatDateFor=formatV04DateFor;
const v05BaseFormatDate=formatV04Date;
formatV04DateFor=function(code,date=new Date()){return v05FormatDate(date,code);};
formatV04Date=function(date=new Date()){return v05FormatDate(date,currentUiLanguage);};
function setV05DateFormat(value,automatic=false){
  v05DateFormat=['locale','ymd','dmy','mdy'].includes(value)?value:'locale';
  const select=document.getElementById('date-format');if(select)select.value=v05DateFormat;
  const note=document.getElementById('date-format-note');if(note)note.textContent=v05Text('표시·인쇄 날짜 형식: ','Display and print date format: ')+v05FormatDate(new Date(),currentUiLanguage);
  if(state.step===6)renderReport();
}
function parseV05Number(value){
  let text=String(value??'').trim().replace(/[\s\u00A0]/g,'');
  if(!text)return NaN;
  const commaDecimal=V05_COMMA_DECIMAL_LANGS.has(currentUiLanguage);
  if(text.includes(',')&&text.includes('.')){
    const commaLast=text.lastIndexOf(',')>text.lastIndexOf('.');
    text=commaLast?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  }else if(text.includes(',')){
    text=commaDecimal?text.replace(',','.'):text.replace(/,/g,'');
  }
  return Number(text);
}
const v05FiniteV04=finiteV04;
finiteV04=function(value,fallback=0,min=0,max=1e12){
  const n=parseV05Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
};
function v05FormatInput(value,decimals=3){
  const n=Number(value);if(!Number.isFinite(n))return '';
  return n.toFixed(decimals).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');
}
function v05PrepareNumericInputs(root=document){
  const comma=V05_COMMA_DECIMAL_LANGS.has(currentUiLanguage);
  root.querySelectorAll?.('input[type="number"],input[data-v05-numeric="true"]').forEach(input=>{
    input.dataset.v05Numeric='true';
    if(comma){input.type='text';input.inputMode='decimal';input.autocomplete='off';}
    else if(input.type==='text'){input.type='number';input.removeAttribute('inputmode');}
  });
}
function v05NormalizeNumericInput(input){
  if(!input||input.dataset.v05Numeric!=='true')return;
  const raw=input.value;if(!raw||!/[,.]/.test(raw))return;
  const n=parseV05Number(raw);if(Number.isFinite(n))input.value=String(n);
}
function v05Profile(){return V04_PROFILES[v04Jurisdiction]||V04_PROFILES.unverified;}
function v05ProfileSelect(){
  const select=document.getElementById('jurisdiction-profile');if(!select)return;
  select.innerHTML=Object.entries(V04_PROFILES).map(([code,p])=>`<option value="${escapeV04(code)}">${escapeV04(p.label)}</option>`).join('');
  select.value=v04Jurisdiction;
}
function v05RenderProfileGovernance(){
  const p=v05Profile(), source=document.getElementById('profile-source');if(!source)return;
  const languageLabel=(UI_LANGUAGE_META.find(item=>item[0]===currentUiLanguage)||[])[1]||currentUiLanguage;
  const languageMismatch=!(V05_PROFILE_LANGUAGES[v04Jurisdiction]||[]).includes(currentUiLanguage);
  const links=[[p.source,p.url],...(p.extraSources||[])].filter(item=>item[1]).map(([label,url])=>`<a href="${escapeV04(url)}" target="_blank" rel="noopener noreferrer">${escapeV04(label)}</a>`).join(' · ');
  const warning=(v04Jurisdiction==='unverified'||languageMismatch)
    ? `<div class="v05-profile-warning">${escapeV04(v04Jurisdiction==='unverified'
      ? v05Text('현지 법규 프로필 미검증 — 회사 절차 및 현지 EHS 검토 필수','Local legal profile is unverified — company procedure and local EHS review are mandatory.')
      : v05Text(`화면 언어(${languageLabel})는 법규를 자동 선택하지 않습니다. 현재 적용 법규 프로필: ${p.scope}.`,`The screen language (${languageLabel}) does not select law. Active legal profile: ${p.scope}.`))}</div>`:'';
  const pref=v05ProfilePreferences(p);
  const approval=v05ApprovalText(p);
  const dateLabel={locale:v05Text('화면 언어','Screen'),ymd:'YYYY.MM.DD',dmy:'DD/MM/YYYY',mdy:'MM/DD/YYYY'}[pref.dateFormat]||pref.dateFormat;
  const prefItems=[[v05Text('용지','Paper'),pref.paper],[v05Text('결과','Results'),pref.resultUnit==='us'?'US + SI':'SI'],[v05Text('입력','Input'),pref.inputUnit==='us'?'ft / CFM':'SI'],[v05Text('날짜','Date'),dateLabel]].map(([label,value])=>`<span><em>${escapeV04(label)}</em><b class="v05-ltr">${escapeV04(value)}</b></span>`).join('');
  source.innerHTML=`${warning}<div class="v05-profile-governance"><dl>
    <dt>${v05Text('프로필 범위','Profile scope')}</dt><dd>${escapeV04(p.scope||'—')}</dd>
    <dt>${v05Text('프로필 버전','Profile version')}</dt><dd class="v05-ltr">${escapeV04(p.profileVersion||'—')}</dd>
    <dt>${v05Text('법규 검토 기준일','Regulatory review baseline')}</dt><dd class="v05-ltr">${escapeV04(p.reviewedAt||'—')}</dd>
    <dt>${v05Text('검토자','Reviewer')}</dt><dd>${escapeV04(p.reviewer||'—')}</dd>
    <dt>${v05Text('다음 검토 예정일','Next review due')}</dt><dd class="v05-ltr">${escapeV04(p.nextReviewDue||'—')}</dd>
    <dt>${v05Text('현지 승인 상태','Local approval status')}</dt><dd>${escapeV04(approval)}<br><small>${escapeV04(p.approvalNote||'—')}</small></dd>
    <dt>${v05Text('공식 출처','Official source')}</dt><dd>${links||escapeV04(p.source||'—')}</dd>
  </dl></div><div class="v05-regional-preference"><div class="v05-regional-heading"><b>${escapeV04(v05Text('문서 출력 설정 추천','Recommended document setup'))}</b><small>${escapeV04(v05Text('현재 설정은 유지됩니다. 필요할 때만 추천을 적용하십시오.','Current settings stay unchanged until you apply this recommendation.'))}</small></div><div class="v05-regional-values">${prefItems}</div><button type="button" onclick="applyV05RegionalRecommendation()">${escapeV04(v05Text('추천 적용','Apply'))}</button></div>`;
}
const v05SetJurisdictionProfile=setJurisdictionProfile;
setJurisdictionProfile=function(value){
  const prior={paper:v04Paper,resultUnit:v04UnitSystem,inputUnit:v05InputUnits,dateFormat:v05DateFormat};
  v05SetJurisdictionProfile(V04_PROFILES[value]?value:'unverified');
  /* The base profile setter historically changed paper/units automatically. Restore them:
     global users must explicitly apply a visible regional recommendation. */
  setPrintPaper(prior.paper);setV04UnitSystem(prior.resultUnit,true);setV05InputUnits(prior.inputUnit,true);setV05DateFormat(prior.dateFormat,true);
  v05RenderProfileGovernance();
};
function applyV05RegionalRecommendation(){
  const pref=v05ProfilePreferences();
  setPrintPaper(pref.paper);setV04UnitSystem(pref.resultUnit,true);setV05InputUnits(pref.inputUnit,true);setV05DateFormat(pref.dateFormat,true);
  v05RenderProfileGovernance();
}
const v05SetUiLanguage=setUiLanguage;
setUiLanguage=function(code){v05SetUiLanguage(code);v05PrepareNumericInputs();v05RenderProfileGovernance();v05RenderRecoveryStatus();};

function setV05InputUnits(value,automatic=false){
  v05InputUnits=value==='us'?'us':'si';if(!automatic)v05InputUnitsTouched=true;
  const select=document.getElementById('input-unit-system');if(select)select.value=v05InputUnits;
  const note=document.getElementById('input-unit-note');if(note)note.textContent=v05InputUnits==='us'
    ?v05Text('입력값은 ft·ft³·CFM으로 표시되며 내부 계산·저장은 SI로 자동 변환됩니다.','Inputs display ft, ft³ and CFM; calculation and saved data are converted to SI.')
    :v05Text('입력값·계산·저장은 SI(m·m³·m³/h)입니다.','Inputs, calculation and saved data use SI (m, m³, m³/h).');
  renderZones();renderFanTable();
}
const v05SerializeSession=serializeSession;
serializeSession=function(){
  const data=v05SerializeSession();
  data.version=5;data.v05InputUnit=v05InputUnits;data.v05DateFormat=v05DateFormat;
  data.v05ProfileVersion=v05Profile()?.profileVersion||'';
  return data;
};
const v05RestoreSession=restoreSession;
restoreSession=function(data){
  const inputUnit=data?.v05InputUnit==='us'?'us':'si';
  const dateFormat=['locale','ymd','dmy','mdy'].includes(data?.v05DateFormat)?data.v05DateFormat:'locale';
  v05RestoreSession(data);
  setV05InputUnits(inputUnit,true);setV05DateFormat(dateFormat,true);v05RenderProfileGovernance();
};
function v05ApplyPhysicalInputUnits(){
  const us=v05InputUnits==='us';
  document.querySelectorAll('#zones-list .zone-card').forEach((card,index)=>{
    const zone=state.zones[index];if(!zone)return;
    const inputs=[...card.querySelectorAll('input[type="number"],input[data-v05-numeric="true"]')];
    const labels=[...card.querySelectorAll('.field label')];
    if(zone.shape==='poly'){
      const values=[...(zone.polyPoints||[]).flatMap(p=>[p.x,p.y]),zone.polyH];
      inputs.forEach((input,i)=>{if(values[i]!==undefined)input.value=v05FormatInput(us?Number(values[i])*V05_FT_PER_M:values[i]);});
    }else{
      const fields=(ZONE_SHAPES[zone.shape]||ZONE_SHAPES.box).fields||[];
      fields.forEach((field,i)=>{const value=Number(zone.vals?.[field.key]||0);inputs[i].value=v05FormatInput(us?(field.key==='v'?value*Math.pow(V05_FT_PER_M,3):value*V05_FT_PER_M):value);});
    }
    if(us)labels.forEach(label=>{label.textContent=label.textContent.replace(/㎥|m³/g,'ft³').replace(/\(m\)/g,'(ft)');});
  });
  const volume=document.getElementById('volume-result');
  if(us&&volume)volume.innerHTML=`${v05FormatInput(state.volume*Math.pow(V05_FT_PER_M,3),2)} <span class="unit" dir="ltr">ft³</span> <span class="hint">(${v05FormatInput(state.volume,2)} m³)</span>`;
}
const v05RenderZones=renderZones;
renderZones=function(){v05RenderZones();v05PrepareNumericInputs(document.getElementById('zones-list')||document);v05ApplyPhysicalInputUnits();};
const v05UpdateZoneField=updateZoneField;
updateZoneField=function(id,key,value){
  let converted=value;
  if(v05InputUnits==='us'&&key!=='name'&&key!=='shape'&&key!=='sign'){const n=parseV05Number(value);converted=key==='v'?n/Math.pow(V05_FT_PER_M,3):n/V05_FT_PER_M;}
  v05UpdateZoneField(id,key,converted);
};
const v05UpdateZonePoly=updateZonePoly;
updateZonePoly=function(id,index,axis,value){const n=parseV05Number(value);v05UpdateZonePoly(id,index,axis,v05InputUnits==='us'?n/V05_FT_PER_M:n);};
const v05RenderFanTable=renderFanTable;
renderFanTable=function(){
  v05RenderFanTable();v05PrepareNumericInputs(document.getElementById('fan-table')||document);
  const headers=[...document.querySelectorAll('#fan-table thead th')];
  if(v05InputUnits!=='us'){if(headers[1])headers[1].textContent=headers[1].textContent.replace('CFM input','㎥/h');return;}
  const rows=[...document.querySelectorAll('#fan-tbody > tr:not(.fan-advanced-row)')];
  rows.forEach((row,index)=>{const fan=state.fans[index];if(!fan)return;const inputs=[...row.querySelectorAll('input')];if(inputs[1])inputs[1].value=v05FormatInput(Number(fan.rated||0)*V05_CFM_PER_CMH);if(inputs[2]&&fan.flowMethod!=='estimate')inputs[2].value=v05FormatInput(Number(fan.appliedFlow||0)*V05_CFM_PER_CMH);const hint=row.querySelector('.fan-basis-wrap .hint');if(hint&&fan.flowMethod!=='estimate')hint.textContent='CFM input';});
  if(headers[1])headers[1].textContent=headers[1].textContent.replace(/㎥\/h|m³\/h/g,'CFM input');
};
const v05UpdateFan=updateFan;
updateFan=function(id,key,value){
  let converted=value;
  if(v05InputUnits==='us'&&(key==='rated'||key==='appliedFlow'))converted=parseV05Number(value)/V05_CFM_PER_CMH;
  v05UpdateFan(id,key,converted);
};

function v05DraftData(){const data=serializeSession();data.version=5;data.autosave=true;data.draftSavedAt=new Date().toISOString();return data;}
const v05SanitizeSession=sanitizeV04Session;
sanitizeV04Session=function(data){
  if(data&&Number(data.version)===5){const copy=JSON.parse(JSON.stringify(data));copy.version=4;return v05SanitizeSession(copy);}
  return v05SanitizeSession(data);
};
function v05RenderRecoveryStatus(){
  const host=document.getElementById('v05-recovery-bar');if(!host)return;
  const draft=safeV04StorageGet(V05_AUTOSAVE_KEY);let saved='';try{saved=draft?JSON.parse(draft).draftSavedAt||'':'';}catch(_){saved='';}
  const when=saved?formatV04DateFor(currentUiLanguage,new Date(saved))+' '+new Intl.DateTimeFormat(localeV04For(currentUiLanguage),{hour:'2-digit',minute:'2-digit'}).format(new Date(saved)):v05Text('저장된 임시본 없음','No draft saved');
  host.innerHTML=`<span class="status">${escapeV04(v05Text('기기 내부 임시저장','Device-local draft'))}</span><span class="muted">${escapeV04(v05Text('서버 전송 없음 · 마지막 저장: ','No server transfer · Last saved: '))}<span class="v05-ltr">${escapeV04(when)}</span></span>${saved?`<button type="button" onclick="restoreV05Draft()">${escapeV04(v05Text('임시본 복원','Restore draft'))}</button><button type="button" onclick="clearV05Draft()">${escapeV04(v05Text('임시본 삭제','Delete draft'))}</button>`:''}`;
}
function saveV05Draft(){
  try{const data=v05DraftData();if(safeV04StorageSet(V05_AUTOSAVE_KEY,JSON.stringify(data))){v05LastDraftAt=data.draftSavedAt;v05RenderRecoveryStatus();}}
  catch(_){v05ShowRuntimeNotice(v05Text('임시저장에 실패했습니다. 파일 저장으로 현재 작업을 보관하십시오.','Draft save failed. Save a session file to preserve current work.'));}
}
function scheduleV05Draft(){clearTimeout(v05DraftTimer);v05DraftTimer=setTimeout(saveV05Draft,650);}
function restoreV05Draft(){try{const raw=safeV04StorageGet(V05_AUTOSAVE_KEY);if(!raw)return;restoreSession(JSON.parse(raw));v05RenderRecoveryStatus();}catch(_){v05ShowRuntimeNotice(v05Text('임시본을 복원할 수 없습니다. 파일 저장본을 사용하십시오.','The draft cannot be restored. Use a saved session file.'));}}
function clearV05Draft(){try{localStorage.removeItem(V05_AUTOSAVE_KEY);}catch(_){}v05RenderRecoveryStatus();}
function v05ShowRuntimeNotice(message){const box=document.getElementById('v05-runtime-notice');if(box){box.textContent=message;box.hidden=false;}}
function v05RuntimeRecovery(){try{saveV05Draft();}catch(_){}v05ShowRuntimeNotice(v05Text('일시적인 오류가 발생했습니다. 입력값은 기기에 보관을 시도했습니다. 새로고침 후 임시본 또는 세션 파일로 복원하십시오.','A temporary error occurred. The app attempted to preserve input on this device. Refresh and restore the draft or a session file.'));}

function v05TraceHTML(){
  const p=v05Profile(),now=new Date(),unit=v04UnitSystem==='us'?'US customary + SI':'SI',input=v05InputUnits==='us'?'ft / ft³ / CFM':'m / m³ / m³/h';
  return `<div class="v05-print-trace"><div><b>Tool</b><span class="v05-ltr">${V05_VERSION}</span></div><div><b>Legal profile</b>${escapeV04(p.label)} <span class="v05-ltr">v${escapeV04(p.profileVersion||'—')}</span></div><div><b>Approval</b>${escapeV04(v05ApprovalText(p))}</div><div><b>Review baseline</b><span class="v05-ltr">${escapeV04(p.reviewedAt||'Unverified')}</span></div><div><b>Screen language</b>${escapeV04((UI_LANGUAGE_META.find(item=>item[0]===currentUiLanguage)||[])[1]||currentUiLanguage)}</div><div><b>Units</b><span class="v05-ltr">${unit}; input ${input}</span></div><div><b>Generated</b><time class="v05-ltr">${escapeV04(now.toISOString().replace('T',' ').slice(0,19)+' UTC')}</time></div></div>`;
}
function v05AddTrace(container){if(!container)return;container.dataset.v05PrintDensity='compact';container.querySelectorAll?.('.v05-print-trace').forEach(node=>node.remove());container.insertAdjacentHTML('afterbegin',v05TraceHTML());}
const v05RenderReport=renderReport;
renderReport=function(){v05RenderReport();v05AddTrace(document.querySelector('.report'));};
const v05RenderTranslatedReports=renderTranslatedReports;
renderTranslatedReports=function(){v05RenderTranslatedReports();document.querySelectorAll('.translated-report,.korean-supplement-report').forEach(section=>{const code=section.dataset.language||currentUiLanguage;section.lang=localeV04For(code);section.dir=['ar','fa','ur'].includes(code)?'rtl':'ltr';v05AddTrace(section);});};
const v05PrintReport=printReport;
printReport=function(){renderReport();renderTranslatedReports();v05PrintReport();};
const v05ShowV04Validation=showV04Validation;
showV04Validation=function(items){
  v05ShowV04Validation(items);
  if(!items?.length)return;
  const box=document.getElementById('validation-summary');if(!box)return;
  const advice=v05Text('수정 안내: 수치는 0보다 큰 값(농도는 0 이상)을 입력하고, 표시 단위와 측정 시각을 확인하십시오.','Correction: enter a value above zero (concentrations may be zero), then verify the displayed unit and measurement time.');
  box.insertAdjacentHTML('beforeend',`<p class="hint"><b>${escapeV04(advice)}</b></p>`);
};

document.addEventListener('DOMContentLoaded',()=>{
  const profile=document.querySelector('.global-profile');
  if(profile&&!document.getElementById('input-unit-system'))profile.insertAdjacentHTML('beforeend',`<div class="field"><label for="input-unit-system">${escapeV04(v05Text('물리 입력 단위','Physical input units'))}</label><select id="input-unit-system" onchange="setV05InputUnits(this.value,false)"><option value="si">SI · m / m³ / m³/h</option><option value="us">US · ft / ft³ / CFM</option></select><small id="input-unit-note" class="hint"></small></div><div class="field"><label for="date-format">${escapeV04(v05Text('문서 날짜 형식','Document date format'))}</label><select id="date-format" onchange="setV05DateFormat(this.value,false)"><option value="locale">${escapeV04(v05Text('화면 언어 형식','Screen-language format'))}</option><option value="ymd">YYYY.MM.DD</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select><small id="date-format-note" class="hint"></small></div>`);
  const session=document.querySelector('.session-bar');if(session&&!document.getElementById('v05-recovery-bar'))session.insertAdjacentHTML('beforebegin',`<div id="v05-recovery-bar" class="v05-recovery-bar no-print" aria-live="polite"></div><div id="v05-runtime-notice" class="v05-runtime-notice no-print" role="alert" hidden></div>`);
  v05ProfileSelect();v05RenderProfileGovernance();v05PrepareNumericInputs();const defaultPref=v05ProfilePreferences();setV05InputUnits(defaultPref.inputUnit,true);setV05DateFormat(defaultPref.dateFormat,true);v05RenderRecoveryStatus();
  document.addEventListener('change',event=>{if(event.target?.matches?.('input[data-v05-numeric="true"],input[type="number"]'))v05NormalizeNumericInput(event.target);scheduleV05Draft();},true);
  document.addEventListener('input',event=>{if(event.target?.matches?.('input,select,textarea'))scheduleV05Draft();},true);
  window.addEventListener('error',v05RuntimeRecovery);window.addEventListener('unhandledrejection',v05RuntimeRecovery);
});
</script>
'''

html = replace_once(html, "</body>", extension + "\n</body>", "v0.5 operations extension")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(html, encoding="utf-8", newline="\n")
print(f"created: {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
