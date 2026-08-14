function selectMode(m){
  state.mode = m;
  document.querySelectorAll('.choice').forEach(c=>{
    c.classList.toggle('selected', c.dataset.mode===m);
  });
}

/* ============================================================
   STEP 2 : 체적 산출 (구역 조합형)
============================================================ */
const ZONE_SHAPES = {
  direct:    { label:'직접입력(체적)',   fields:[{key:'v',label:'체적(㎥)'}] },
  box:       { label:'사각기둥',        fields:[{key:'l',label:'가로(m)'},{key:'w',label:'세로(m)'},{key:'h',label:'높이(m)'}] },
  cyl:       { label:'원기둥',          fields:[{key:'r',label:'반지름(m)'},{key:'h',label:'높이(m)'}] },
  tri:       { label:'삼각기둥',        fields:[{key:'base',label:'밑변(m)'},{key:'height',label:'삼각형 높이(m)'},{key:'depth',label:'깊이(m)'}] },
  frustum:   { label:'원뿔대',          fields:[{key:'d1',label:'상부 지름(m)'},{key:'d2',label:'하부 지름(m)'},{key:'h',label:'높이(m)'}] },
  trapezoid: { label:'사다리꼴 단면',    fields:[{key:'b1',label:'밑변1(m)'},{key:'b2',label:'밑변2(m)'},{key:'h',label:'사다리꼴 높이(m)'},{key:'depth',label:'깊이(m)'}] },
  poly:      { label:'임의 다각형(전문가용)', fields:[] },
};
const ZONE_HINT = {
  box:'체적 = 가로 × 세로 × 높이',
  cyl:'체적 = π × 반지름² × 높이',
  tri:'체적 = (밑변 × 높이 ÷ 2) × 깊이',
  frustum:'체적 = (π × 높이 ÷ 3) × (R1² + R1×R2 + R2²)  — R1·R2는 지름의 절반. 경사진 맨홀·하수관 접속부 등에 활용',
  trapezoid:'체적 = ((밑변1 + 밑변2) ÷ 2 × 높이) × 깊이 — 경사면이 있는 암거·집수조 등에 활용',
  poly:'체적 = 다각형 단면적(Shoelace 공식) × 높이',
  direct:'이미 알고 있는 체적을 그대로 입력',
};
const ZONE_SHAPES_EN = {
  direct:{label:'Direct volume entry',fields:[{key:'v',label:'Volume (㎥)'}]},
  box:{label:'Rectangular prism',fields:[{key:'l',label:'Length (m)'},{key:'w',label:'Width (m)'},{key:'h',label:'Height (m)'}]},
  cyl:{label:'Cylinder',fields:[{key:'r',label:'Radius (m)'},{key:'h',label:'Height (m)'}]},
  tri:{label:'Triangular prism',fields:[{key:'base',label:'Base (m)'},{key:'height',label:'Triangle height (m)'},{key:'depth',label:'Depth (m)'}]},
  frustum:{label:'Conical frustum',fields:[{key:'d1',label:'Top diameter (m)'},{key:'d2',label:'Bottom diameter (m)'},{key:'h',label:'Height (m)'}]},
  trapezoid:{label:'Trapezoidal section',fields:[{key:'b1',label:'Base 1 (m)'},{key:'b2',label:'Base 2 (m)'},{key:'h',label:'Section height (m)'},{key:'depth',label:'Depth (m)'}]},
  poly:{label:'Custom polygon (advanced)',fields:[]}
};
const ZONE_HINT_EN = {
  box:'Volume = length × width × height',
  cyl:'Volume = π × radius² × height',
  tri:'Volume = (base × height ÷ 2) × depth',
  frustum:'Volume = (π × height ÷ 3) × (R1² + R1×R2 + R2²)',
  trapezoid:'Volume = ((base 1 + base 2) ÷ 2 × height) × depth',
  poly:'Volume = polygon area (shoelace formula) × height',
  direct:'Enter a known volume directly'
};
function getZoneShapes(){
  if(currentUiLanguage==='ko') return ZONE_SHAPES;
  if(currentUiLanguage==='en') return ZONE_SHAPES_EN;
  const b=getUiBasic();
  return {
    direct:{label:b.direct,fields:[{key:'v',label:'V (㎥)'}]},
    box:{label:b.box,fields:[{key:'l',label:'L (m)'},{key:'w',label:'W (m)'},{key:'h',label:'H (m)'}]},
    cyl:{label:b.cylinder,fields:[{key:'r',label:'R (m)'},{key:'h',label:'H (m)'}]},
    tri:{label:b.triangle,fields:[{key:'base',label:'B (m)'},{key:'height',label:'H (m)'},{key:'depth',label:'D (m)'}]},
    frustum:{label:b.frustum,fields:[{key:'d1',label:'D1 (m)'},{key:'d2',label:'D2 (m)'},{key:'h',label:'H (m)'}]},
    trapezoid:{label:b.trapezoid,fields:[{key:'b1',label:'B1 (m)'},{key:'b2',label:'B2 (m)'},{key:'h',label:'H (m)'},{key:'depth',label:'D (m)'}]},
    poly:{label:b.polygon,fields:[]}
  };
}
function getZoneHints(){
  if(currentUiLanguage==='ko') return ZONE_HINT;
  if(currentUiLanguage==='en') return ZONE_HINT_EN;
  return {
    box:'V = L × W × H',cyl:'V = π × R² × H',tri:'V = (B × H ÷ 2) × D',
    frustum:'V = (π × H ÷ 3) × (R1² + R1×R2 + R2²)',
    trapezoid:'V = ((B1 + B2) ÷ 2 × H) × D',
    poly:'V = A × H',direct:'V (㎥)'
  };
}

function addZone(shape){
  state.zones.push({
    id: state.zoneIdSeq++,
    name: '',
    shape: shape || 'direct',
    sign: 1,
    vals: {},
    polyPoints: [],
    polyH: '',
    volume: 0
  });
  renderZones();
}
function removeZone(id){
  state.zones = state.zones.filter(z=>z.id!==id);
  renderZones();
}
function updateZoneField(id, key, val){
  const z = state.zones.find(z=>z.id===id);
  if(!z) return;
  if(key==='name') z.name = val;
  else if(key==='shape'){ z.shape = val; z.vals = {}; z.polyPoints = []; z.polyH = ''; }
  else if(key==='sign') z.sign = parseInt(val,10);
  else if(key==='polyH') z.polyH = val;
  else z.vals[key] = parseFloat(val);
  renderZones();
}
function addZonePolyPoint(id){
  const z = state.zones.find(z=>z.id===id);
  if(!z) return;
  z.polyPoints.push({x:'', y:''});
  renderZones();
}
function updateZonePoly(id, idx, axis, val){
  const z = state.zones.find(z=>z.id===id);
  if(!z) return;
  z.polyPoints[idx][axis] = parseFloat(val);
  renderZones();
}
function resetZonePoly(id){
  const z = state.zones.find(z=>z.id===id);
  if(!z) return;
  z.polyPoints = [{x:'',y:''},{x:'',y:''},{x:'',y:''},{x:'',y:''}];
  renderZones();
}

function shoelaceArea(points){
  const pts = (points||[]).filter(p=>p && !isNaN(p.x) && !isNaN(p.y) && p.x!=='' && p.y!=='');
  if(pts.length < 3) return 0;
  let sum = 0;
  for(let i=0;i<pts.length;i++){
    const p1 = pts[i], p2 = pts[(i+1)%pts.length];
    sum += (p1.x * p2.y) - (p2.x * p1.y);
  }
  return Math.abs(sum)/2;
}

function computeZoneVolume(z){
  const v = z.vals || {};
  switch(z.shape){
    case 'direct': return v.v || 0;
    case 'box': return (v.l||0)*(v.w||0)*(v.h||0);
    case 'cyl': return Math.PI*(v.r||0)*(v.r||0)*(v.h||0);
    case 'tri': return ((v.base||0)*(v.height||0)/2)*(v.depth||0);
    case 'frustum': {
      const R1=(v.d1||0)/2, R2=(v.d2||0)/2, h=v.h||0;
      return (Math.PI*h/3)*(R1*R1 + R1*R2 + R2*R2);
    }
    case 'trapezoid': return (((v.b1||0)+(v.b2||0))/2*(v.h||0))*(v.depth||0);
    case 'poly': {
      const area = shoelaceArea(z.polyPoints||[]);
      return area * (parseFloat(z.polyH)||0);
    }
    default: return 0;
  }
}

function zonePolyFieldsHTML(z){
  if(!z.polyPoints || z.polyPoints.length===0){
    z.polyPoints = [{x:'',y:''},{x:'',y:''},{x:'',y:''},{x:'',y:''}];
  }
  const rows = z.polyPoints.map((p,idx)=>`
    <div class="poly-row">
      <span>${idx+1}</span>
      <input type="number" step="0.01" placeholder="x (m)" value="${p.x!==undefined?p.x:''}" onchange="updateZonePoly(${z.id},${idx},'x',this.value)">
      <input type="number" step="0.01" placeholder="y (m)" value="${p.y!==undefined?p.y:''}" onchange="updateZonePoly(${z.id},${idx},'y',this.value)">
    </div>`).join('');
  const area = shoelaceArea(z.polyPoints);
  const foreign=currentUiLanguage!=='ko';
  const english=currentUiLanguage==='en';
  const basic=getUiBasic();
  return `
    <div class="field">
      <label>${foreign?(english?'Section vertex coordinates (x, y)':basic.polygon+' (x, y)'):'단면 꼭짓점 좌표(x, y)'}
        <button type="button" class="info-toggle" onclick="toggleInfo(this)">ⓘ</button>
      </label>
      <div class="info-box" hidden>
        ${foreign?(english?'Choose an origin (0,0) and enter at least three vertices in clockwise or counter-clockwise order.':'(x1,y1) → (x2,y2) → (x3,y3)'):'도면(또는 실측)에서 임의의 기준점을 원점(0,0)으로 정하고, 나머지 꼭짓점들의 좌표를 <b>한쪽 방향(시계 또는 반시계)으로 순서대로</b> 읽어 입력하십시오. 최소 3개 이상의 좌표가 필요합니다. 순서가 뒤섞이면 면적이 잘못 계산됩니다.'}
      </div>
    </div>
    <div>${rows}</div>
    <div style="display:flex;gap:8px;margin:6px 0 12px;">
      <button type="button" class="btn small secondary" onclick="addZonePolyPoint(${z.id})">${foreign?'+ '+basic.addPoint:'+ 좌표 추가'}</button>
      <button type="button" class="btn small ghost" onclick="resetZonePoly(${z.id})">${foreign?basic.reset:'초기화'}</button>
    </div>
    <div class="field">
      <label>${foreign?(english?'Section height / depth':'H / D'):'단면 높이(깊이)'} <span class="opt">m</span></label>
      <input type="number" step="0.01" min="0" value="${z.polyH||''}" onchange="updateZoneField(${z.id},'polyH',this.value)">
    </div>
    <div class="hint">${foreign?(english?'Section area':'A'):'단면적'}: ${area.toFixed(3)} ㎡</div>
  `;
}

function zoneCardHTML(z){
  const shapes=getZoneShapes();
  const hints=getZoneHints();
  const foreign=currentUiLanguage!=='ko';
  const basic=getUiBasic();
  const english=currentUiLanguage==='en';
  const pt=PRINT_I18N[currentUiLanguage] || PRINT_I18N.en;
  const info = shapes[z.shape] || shapes.box;
  const fieldsHTML = (z.shape==='poly')
    ? zonePolyFieldsHTML(z)
    : `<div class="grid cols-3">` + info.fields.map(f=>`
        <div class="field">
          <label>${f.label}</label>
          <input type="number" step="0.01" min="0" value="${(z.vals&&z.vals[f.key]!==undefined&&!isNaN(z.vals[f.key]))?z.vals[f.key]:''}" onchange="updateZoneField(${z.id},'${f.key}',this.value)">
        </div>`).join('') + `</div>`;
  const shapeOptions = Object.entries(shapes).map(([key,inf])=>
    `<option value="${key}" ${z.shape===key?'selected':''}>${inf.label}</option>`).join('');

  return `
    <div class="zone-card">
      <div class="zone-card-head">
        <input type="text" class="zone-name" placeholder="${foreign?(basic.zone+' ('+basic.optional+')'):'구역명(선택, 예: 본체)'}" value="${escapeV04(z.name||'')}" onchange="updateZoneField(${z.id},'name',this.value)">
        <select onchange="updateZoneField(${z.id},'shape',this.value)">${shapeOptions}</select>
        <div class="zone-sign">
          <button type="button" class="${z.sign!==-1?'active':''}" onclick="updateZoneField(${z.id},'sign',1)">+ ${foreign?basic.add:'합산'}</button>
          <button type="button" class="${z.sign===-1?'active':''}" onclick="updateZoneField(${z.id},'sign',-1)">− ${foreign?basic.subtract:'차감'}</button>
        </div>
        <button type="button" class="btn small danger" onclick="removeZone(${z.id})">${foreign?basic.delete:'삭제'}</button>
      </div>
      ${fieldsHTML}
      <div class="hint">${hints[z.shape]||''}</div>
      <div class="zone-volume">${foreign?(english?'Zone volume':pt.l.volume):'이 구역 체적'}: ${z.sign===-1?'−':'+'}${(z.volume||0).toFixed(2)} ㎥</div>
    </div>
  `;
}

function renderZones(){
  state.zones.forEach(z=>{ z.volume = computeZoneVolume(z); });
  const wrap = document.getElementById('zones-list');
  if(wrap) wrap.innerHTML = state.zones.map(z=>zoneCardHTML(z)).join('');

  let total = 0;
  state.zones.forEach(z=>{ total += (z.sign===-1?-1:1)*(z.volume||0); });
  total = Math.max(0, total);
  const ratioEl = document.getElementById('space-ratio');
  const ratio = ratioEl ? (parseFloat(ratioEl.value)||100) : 100;
  state.volume = total * (ratio/100);

  const el = document.getElementById('volume-result');
  if(el) el.innerHTML = state.volume.toFixed(2) + ' <span class="unit">㎥</span>';
}

/* ============================================================
   STEP 3 : 작업조건
============================================================ */
