/* ============================================================
   v0.5 GLOBAL OPERATIONS EXTENSION
   Internal calculation and stored data remain SI.
============================================================ */
const V05_VERSION=APP_VERSION;
const V05_AUTOSAVE_KEY='ventcalc-v05-draft';
const V05_COMMA_DECIMAL_LANGS=new Set(['fr','de','pt','es','it','ro','hu','pl','tr','cs','ru','uk','kk','uz']);
const V05_PROFILE_LANGUAGES={kr:['ko'],'us-general':['en','es'],'us-construction':['en','es'],uk:['en'],au:['en'],sg:['en','zh','zht','ms'],jp:['ja'],br:['pt'],unverified:[]};
const V05_INPUT_UNIT_LABELS={
  ko:'물리 입력 단위',en:'Physical input units',zh:'输入单位',zht:'輸入單位',ja:'入力単位',vi:'Đơn vị nhập',th:'หน่วยป้อนข้อมูล',id:'Satuan input',ms:'Unit input',hi:'इनपुट इकाइयाँ',bn:'ইনপুট একক',fil:'Yunit ng input',my:'ထည့်သွင်းယူနစ်',km:'ឯកតាបញ្ចូល',mn:'Оролтын нэгж',es:'Unidades de entrada',pt:'Unidades de entrada',ar:'وحدات الإدخال',fa:'واحدهای ورودی',ur:'ان پٹ اکائیاں',ru:'Единицы ввода',uk:'Одиниці введення',pl:'Jednostki wejściowe',tr:'Giriş birimleri',de:'Eingabeeinheiten',fr:'Unités d’entrée',it:'Unità di input',cs:'Vstupní jednotky',ro:'Unități de intrare',hu:'Bemeneti mértékegységek',kk:'Енгізу бірліктері',uz:'Kiritish birliklari'
};
const V05_FT_PER_M=3.280839895;
const V05_CFM_PER_CMH=0.588577779;
let v05InputUnits='si';
let v05InputUnitsTouched=false;
/* The default profile is Korea, so show its explicit YYYY.MM.DD convention from first launch. */
let v05DateFormat='ymd';
let v05DraftTimer=0;
let v05LastDraftAt='';

function v05Terms(){return v04Terms(currentUiLanguage);}
function v05InputUnitLabel(code=currentUiLanguage){return V05_INPUT_UNIT_LABELS[code]||V05_INPUT_UNIT_LABELS.en;}
function v05ProfilePreferences(p=v05Profile()){return {paper:p?.regionalPreferences?.paper==='Letter'?'Letter':'A4',resultUnit:p?.regionalPreferences?.resultUnit==='us'?'us':'si',inputUnit:p?.regionalPreferences?.inputUnit==='us'?'us':'si',dateFormat:['locale','ymd','dmy','mdy'].includes(p?.regionalPreferences?.dateFormat)?p.regionalPreferences.dateFormat:'locale'};}
function v05FormatDate(date,code=currentUiLanguage){
  const d=date instanceof Date?date:new Date(date);if(Number.isNaN(d.getTime()))return '—';
  if(v05DateFormat==='locale')return v05BaseFormatDateFor(code,d);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return v05DateFormat==='mdy'?`${m}/${day}/${y}`:v05DateFormat==='dmy'?`${day}/${m}/${y}`:`${y}.${m}.${day}`;
}
const v05BaseFormatDateFor=formatV04DateFor;
const v05BaseFormatDate=formatV04Date;
function v05LocaleDateOptionLabel(code=currentUiLanguage){
  return `${v05ProfileLanguageName(code)} · ${v05BaseFormatDateFor(code,new Date(2026,7,20,12,0,0))}`;
}
formatV04DateFor=function(code,date=new Date()){return v05FormatDate(date,code);};
formatV04Date=function(date=new Date()){return v05FormatDate(date,currentUiLanguage);};
function setV05DateFormat(value,automatic=false){
  v05DateFormat=['locale','ymd','dmy','mdy'].includes(value)?value:'locale';
  const select=document.getElementById('date-format');if(select)select.value=v05DateFormat;
  const note=document.getElementById('date-format-note');if(note)note.textContent=(PRINT_I18N[currentUiLanguage]?.l?.date||v05Terms()[6])+': '+v05FormatDate(new Date(),currentUiLanguage);
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
  const languageLabel=v05BilingualLanguageName(currentUiLanguage,currentUiLanguage);
  const languageMismatch=!(V05_PROFILE_LANGUAGES[v04Jurisdiction]||[]).includes(currentUiLanguage);
  const sourceLanguage=v05LegalSourceLanguage(v04Jurisdiction),sourceLocale=localeV04For(sourceLanguage);
  const sourceDir=['ar','fa','ur'].includes(sourceLanguage)?'rtl':'ltr';
  const sourceLanguageLabel=v05BilingualLanguageName(sourceLanguage,currentUiLanguage);
  const links=[[p.source,p.url],...(p.extraSources||[])].filter(item=>item[1]).map(([label,url])=>`<a lang="${escapeV04(sourceLocale)}" dir="${sourceDir}" href="${escapeV04(url)}" target="_blank" rel="noopener noreferrer">${escapeV04(label)}</a>`).join(' · ');
  const t=v05Terms(), profileName=v05ProfileDisplayName(v04Jurisdiction,currentUiLanguage);
  const warning=(v04Jurisdiction==='unverified'||languageMismatch)
    ? `<div class="v05-profile-warning"><b>${escapeV04(getUiText(currentUiLanguage)[2])}:</b> ${escapeV04(languageLabel)} · <b>${escapeV04(t[1])}:</b> ${escapeV04(sourceLanguageLabel)}</div>`:'';
  source.innerHTML=`${warning}<div class="v05-profile-governance"><dl>
    <dt>${escapeV04(t[2])}</dt><dd>${escapeV04(profileName)}</dd>
    <dt>v</dt><dd class="v05-ltr">${escapeV04(p.profileVersion||'—')} · ${escapeV04(p.reviewedAt||'—')}</dd>
    <dt>${escapeV04(t[1])}</dt><dd>${links||escapeV04(p.source||'—')}</dd>
  </dl><small>${escapeV04(t[4])}</small></div>`;
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
function v05RefreshOperationalLabels(){
  const t=v05Terms(),profileUi=V04_UI[currentUiLanguage]||V04_UI.en;
  const dateText=`${PRINT_I18N[currentUiLanguage]?.l?.date||t[6]} · YYYY/MM/DD`;
  const inputLabel=v05InputUnitLabel();
  const input=document.querySelector('label[for="input-unit-system"]');if(input)input.textContent=inputLabel;
  const inputSelect=document.getElementById('input-unit-system');if(inputSelect)inputSelect.setAttribute('aria-label',inputLabel);
  const resultSelect=document.getElementById('unit-system');if(resultSelect)resultSelect.setAttribute('aria-label',t[0]);
  const date=document.querySelector('label[for="date-format"]');if(date)date.textContent=dateText;
  const dateSelect=document.getElementById('date-format');if(dateSelect)dateSelect.setAttribute('aria-label',dateText);
  const profileSelect=document.getElementById('jurisdiction-profile');if(profileSelect)profileSelect.setAttribute('aria-label',profileUi[0]);
  const paperSelect=document.getElementById('paper-size');if(paperSelect)paperSelect.setAttribute('aria-label',profileUi[2]);
  const locale=document.querySelector('#date-format option[value="locale"]');if(locale)locale.textContent=v05LocaleDateOptionLabel();
}
const v05SetUiLanguage=setUiLanguage;
setUiLanguage=function(code){v05SetUiLanguage(code);v05RefreshProfileOptions();v05RefreshOperationalLabels();v05PrepareNumericInputs();v05RenderProfileGovernance();setV05InputUnits(v05InputUnits,true);setV05DateFormat(v05DateFormat,true);v05RenderRecoveryStatus();};

function setV05InputUnits(value,automatic=false){
  v05InputUnits=value==='us'?'us':'si';if(!automatic)v05InputUnitsTouched=true;
  const select=document.getElementById('input-unit-system');if(select)select.value=v05InputUnits;
  const note=document.getElementById('input-unit-note');if(note)note.textContent=v05InputUnits==='us'?'ft · ft³ · CFM → SI':'SI · m · m³ · m³/h';
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
  const when=saved?formatV04DateFor(currentUiLanguage,new Date(saved))+' '+new Intl.DateTimeFormat(localeV04For(currentUiLanguage),{hour:'2-digit',minute:'2-digit'}).format(new Date(saved)):'';
  const ui=getUiText(),basic=getUiBasic();
  host.innerHTML=saved?`<time class="muted v05-ltr" datetime="${escapeV04(saved)}">${escapeV04(when)}</time><button type="button" onclick="restoreV05Draft()">${escapeV04(ui[11])}</button><button type="button" onclick="clearV05Draft()">${escapeV04(basic.delete)}</button>`:'';
}
function saveV05Draft(){
  try{const data=v05DraftData();if(safeV04StorageSet(V05_AUTOSAVE_KEY,JSON.stringify(data))){v05LastDraftAt=data.draftSavedAt;v05RenderRecoveryStatus();}}
  catch(_){v05ShowRuntimeNotice(getFullUiText().saveError);}
}
function scheduleV05Draft(){clearTimeout(v05DraftTimer);v05DraftTimer=setTimeout(saveV05Draft,650);}
function restoreV05Draft(){try{const raw=safeV04StorageGet(V05_AUTOSAVE_KEY);if(!raw)return;restoreSession(JSON.parse(raw));v05RenderRecoveryStatus();}catch(_){v05ShowRuntimeNotice(getFullUiText().sessionReadError);}}
function clearV05Draft(){try{localStorage.removeItem(V05_AUTOSAVE_KEY);}catch(_){}v05RenderRecoveryStatus();}
function v05ShowRuntimeNotice(message){const box=document.getElementById('v05-runtime-notice');if(box){box.textContent=message;box.hidden=false;}}
function v05RuntimeRecovery(){try{saveV05Draft();}catch(_){}v05ShowRuntimeNotice(getFullUiText().saveError);}

function v05TraceHTML(documentLanguage=currentUiLanguage){
  const p=v05Profile(),now=new Date(),terms=v04Terms(documentLanguage),profileUi=V04_UI[documentLanguage]||V04_UI.en;
  const dateLabel=PRINT_I18N[documentLanguage]?.l?.date||terms[6];
  const unit=v04UnitSystem==='us'?'US + SI':'SI',input=v05InputUnits==='us'?'ft · ft³ · CFM':'m · m³ · m³/h';
  return `<div class="v05-print-trace"><div><b>${V05_VERSION}</b><span class="v05-ltr">v${escapeV04(p.profileVersion||'—')} · ${escapeV04(p.reviewedAt||'—')}</span></div><div><b>${escapeV04(profileUi[0])}</b>${escapeV04(v05ProfileDisplayName(v04Jurisdiction,documentLanguage))}</div><div><b>${escapeV04(terms[0])}</b><span class="v05-ltr">${unit} · ${input}</span></div><div><b>${escapeV04(dateLabel)}</b><time class="v05-ltr">${escapeV04(v05FormatDate(now,documentLanguage))}</time></div></div>`;
}
function v05AddTrace(container){
  if(!container)return;
  const fanCount=Array.isArray(state?.fans)?state.fans.length:0;
  container.dataset.v05PrintDensity='compact';
  container.dataset.v05FanCount=String(fanCount);
  container.dataset.v05PrintLayout=fanCount<=4?'one-page':'multi-page';
  container.querySelectorAll?.('.v05-print-trace').forEach(node=>node.remove());
  container.insertAdjacentHTML('afterbegin',v05TraceHTML(container.dataset.language||currentUiLanguage));
}
const v05RenderReport=renderReport;
function v05TraceTranslatedReports(){
  document.querySelectorAll('.translated-report,.korean-supplement-report').forEach(section=>{
    const code=section.dataset.language||currentUiLanguage;
    section.lang=localeV04For(code);section.dir=['ar','fa','ur'].includes(code)?'rtl':'ltr';v05AddTrace(section);
  });
}
renderReport=function(){v05RenderReport();v05AddTrace(document.querySelector('.report'));v05TraceTranslatedReports();};
const v05RenderTranslatedReports=renderTranslatedReports;
renderTranslatedReports=function(){v05RenderTranslatedReports();v05TraceTranslatedReports();};
const v05PrintReport=printReport;
printReport=function(){renderReport();renderTranslatedReports();v05PrintReport();};
const v05ShowV04Validation=showV04Validation;
showV04Validation=function(items){v05ShowV04Validation(items);};

document.addEventListener('DOMContentLoaded',()=>{
  const profile=document.querySelector('.global-profile');
  if(profile&&!document.getElementById('input-unit-system')){const t=v05Terms(),inputLabel=v05InputUnitLabel(),dateText=`${PRINT_I18N[currentUiLanguage]?.l?.date||t[6]} · YYYY/MM/DD`;profile.insertAdjacentHTML('beforeend',`<div class="field"><label for="input-unit-system">${escapeV04(inputLabel)}</label><select id="input-unit-system" aria-label="${escapeV04(inputLabel)}" onchange="setV05InputUnits(this.value,false)"><option value="si">SI · m / m³ / m³/h</option><option value="us">US · ft / ft³ / CFM</option></select><small id="input-unit-note" class="hint"></small></div><div class="field"><label for="date-format">${escapeV04(dateText)}</label><select id="date-format" aria-label="${escapeV04(dateText)}" onchange="setV05DateFormat(this.value,false)"><option value="locale">${escapeV04(v05LocaleDateOptionLabel())}</option><option value="ymd">YYYY.MM.DD</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select><small id="date-format-note" class="hint"></small></div>`);}
  const session=document.querySelector('.session-bar');if(session&&!document.getElementById('v05-recovery-bar'))session.insertAdjacentHTML('beforebegin',`<div id="v05-recovery-bar" class="v05-recovery-bar no-print" aria-live="polite"></div><div id="v05-runtime-notice" class="v05-runtime-notice no-print" role="alert" hidden></div>`);
  v05ProfileSelect();v05RefreshProfileOptions();v05RefreshOperationalLabels();v05RenderProfileGovernance();v05PrepareNumericInputs();const defaultPref=v05ProfilePreferences();setV05InputUnits(defaultPref.inputUnit,true);setV05DateFormat(defaultPref.dateFormat,true);v05RenderRecoveryStatus();
  document.addEventListener('change',event=>{if(event.target?.matches?.('input[data-v05-numeric="true"],input[type="number"]'))v05NormalizeNumericInput(event.target);scheduleV05Draft();},true);
  document.addEventListener('input',event=>{if(event.target?.matches?.('input,select,textarea'))scheduleV05Draft();},true);
  window.addEventListener('error',v05RuntimeRecovery);window.addEventListener('unhandledrejection',v05RuntimeRecovery);
});
