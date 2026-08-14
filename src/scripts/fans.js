function addFanRow(name, rated, eff, explosion){
  state.fans.push({
    id: state.fanIdSeq++,
    name: name || '',
    rated: rated || 0,
    eff: (eff===undefined? 75: eff),
    flowMethod: 'estimate',
    appliedFlow: 0,
    ductDiameter: 0,
    ductLength: 0,
    bendCount: 0,
    staticPressure: 0,
    advancedNote: '',
    advancedOpen: false,
    explosion: explosion || false,
    qty: 1
  });
  renderFanTable();
}
function removeFan(id){
  state.fans = state.fans.filter(f=>f.id!==id);
  renderFanTable();
}
function updateFan(id, key, val){
  const f = state.fans.find(f=>f.id===id);
  if(!f) return;
  if(key==='explosion') f[key]=val;
  else if(key==='name' || key==='flowMethod' || key==='advancedNote') f[key]=val;
  else f[key] = parseFloat(val)||0;
  renderFanTable();
}
function getFanEffective(f){
  if(f.flowMethod==='manufacturer' || f.flowMethod==='measured'){
    return Math.max(0, parseFloat(f.appliedFlow)||0);
  }
  return Math.max(0, (parseFloat(f.rated)||0) * ((parseFloat(f.eff)||0)/100));
}
function setFanAdvancedOpen(id, isOpen){
  const f = state.fans.find(f=>f.id===id);
  if(f) f.advancedOpen = isOpen;
}
function fanMethodLabel(method){
  if(currentUiLanguage!=='ko'){
    return (PRINT_I18N[currentUiLanguage] || PRINT_I18N.en).methods?.[method] || UI_DETAIL_EN.fanMethods[method] || method;
  }
  return {
    estimate:'간편 보정',
    manufacturer:'제조사 운전점',
    measured:'현장 실측'
  }[method] || '간편 보정';
}
function renderFanTable(){
  const tbody = document.getElementById('fan-tbody');
  const requiredQ = getRequiredQ();
  const foreign=currentUiLanguage!=='ko';
  const english=currentUiLanguage==='en';
  const basic=getUiBasic();
  const detail=foreign?getFullUiText():UI_DETAIL_EN;
  const printText=PRINT_I18N[currentUiLanguage] || PRINT_I18N.en;
  const methods=V04_FAN_METHODS[currentUiLanguage] || printText.methods || UI_DETAIL_EN.fanMethods;
  const labels=printText.l || PRINT_I18N.en.l;
  tbody.innerHTML='';
  let totalSupply = 0;

  state.fans.forEach(f=>{
    const effective = getFanEffective(f);
    const needQty = effective>0 ? Math.ceil(requiredQ/effective) : 0;
    const supply = effective * f.qty;
    totalSupply += supply;
    const basisInput = f.flowMethod==='estimate'
      ? `<div class="fan-basis-wrap"><input class="fan-basis-input" type="number" value="${f.eff}" min="0" max="100" onchange="updateFan(${f.id},'eff',this.value)"><div class="hint">${english?detail.efficiency:''} %</div></div>`
      : `<div class="fan-basis-wrap"><input class="fan-basis-input" type="number" value="${f.appliedFlow||0}" min="0" step="0.1" onchange="updateFan(${f.id},'appliedFlow',this.value)"><div class="hint">${english?(f.flowMethod==='measured'?detail.measured:detail.operatingPoint):''} ㎥/h</div></div>`;
    const diameterM = (parseFloat(f.ductDiameter)||0)/1000;
    const ductVelocity = diameterM>0 && effective>0
      ? effective/3600/(Math.PI*Math.pow(diameterM,2)/4)
      : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="${foreign?labels.equipment:'장비명'}"><input type="text" value="${escapeV04(f.name)}" onchange="updateFan(${f.id},'name',this.value)" placeholder="${foreign?labels.equipment:'예: 이동식 송풍기 #1'}"></td>
      <td data-label="${foreign?labels.rated+' (㎥/h)':'정격풍량(㎥/h)'}"><input type="number" value="${f.rated}" min="0" onchange="updateFan(${f.id},'rated',this.value)"></td>
      <td data-label="${foreign?labels.basis:'풍량 적용방식'}"><select onchange="updateFan(${f.id},'flowMethod',this.value)">
        <option value="estimate" ${f.flowMethod==='estimate'?'selected':''}>${methods.estimate || detail.fanMethods.estimate}</option>
        <option value="manufacturer" ${f.flowMethod==='manufacturer'?'selected':''}>${methods.manufacturer || detail.fanMethods.manufacturer}</option>
        <option value="measured" ${f.flowMethod==='measured'?'selected':''}>${methods.measured || detail.fanMethods.measured}</option>
      </select></td>
      <td data-label="${foreign?(english?'Correction / input':'% / Q'):'보정값'}">${basisInput}</td>
      <td data-label="${foreign?labels.explosion:'방폭'}"><input type="checkbox" ${f.explosion?'checked':''} onchange="updateFan(${f.id},'explosion',this.checked)"></td>
      <td data-label="${foreign?labels.applied+' (㎥/h)':'적용풍량(㎥/h)'}"><div class="fan-output-wrap">${effective.toFixed(1)}<div class="hint" style="margin-top:2px;">${foreign?labels.required:'필요'} ${needQty}</div></div></td>
      <td data-label="${foreign?labels.qty:'계획 대수'}"><input type="number" value="${f.qty}" min="0" onchange="updateFan(${f.id},'qty',this.value)"></td>
      <td data-label="${foreign?labels.supply+' (㎥/h)':'공급풍량(㎥/h)'}">${supply.toFixed(1)}</td>
      <td class="fan-delete-cell"><button class="btn small danger fan-delete-btn" onclick="removeFan(${f.id})">${foreign?basic.delete:'삭제'}</button></td>
    `;
    tbody.appendChild(tr);
    const advancedTr = document.createElement('tr');
    advancedTr.className = 'fan-advanced-row';
    advancedTr.innerHTML = `<td colspan="9">
      <details class="fan-advanced" ${f.advancedOpen?'open':''} ontoggle="setFanAdvancedOpen(${f.id},this.open)">
        <summary>${foreign?detail.optionalDuct:'선택 입력 · 덕트·정압 조건'} ${foreign?'('+(f.flowMethod==='estimate'?detail.currentEfficiency:detail.recordBasis)+')':(f.flowMethod==='estimate'?'(계산에는 현재 유효율 적용)':'(풍량 근거 기록)')}</summary>
        <div class="fan-advanced-grid">
          <div class="field"><label>${foreign?detail.ductDiameter:'덕트 지름'} (mm)</label><input type="number" min="0" value="${f.ductDiameter||0}" onchange="updateFan(${f.id},'ductDiameter',this.value)"></div>
          <div class="field"><label>${foreign?detail.ductLength:'덕트 길이'} (m)</label><input type="number" min="0" step="0.1" value="${f.ductLength||0}" onchange="updateFan(${f.id},'ductLength',this.value)"></div>
          <div class="field"><label>${foreign?detail.bendCount:'굴곡 개수'}</label><input type="number" min="0" step="1" value="${f.bendCount||0}" onchange="updateFan(${f.id},'bendCount',this.value)"></div>
          <div class="field"><label>${foreign?detail.staticPressure:'운전 정압'} (Pa)</label><input type="number" min="0" step="1" value="${f.staticPressure||0}" onchange="updateFan(${f.id},'staticPressure',this.value)"></div>
          <div class="field fan-advanced-note"><label>${foreign?detail.performanceNote:'성능자료·실측 메모'}</label><input type="text" value="${escapeV04(f.advancedNote||'')}" onchange="updateFan(${f.id},'advancedNote',this.value)" placeholder="${foreign?'—':'예: 제조사 곡선 250Pa / 열선풍속계 실측'}"></div>
        </div>
        <div class="hint">${english?(ductVelocity>0?`Average duct velocity from applied airflow: <b>${ductVelocity.toFixed(2)} m/s</b>. `:''):(foreign?(ductVelocity>0?`v = <b>${ductVelocity.toFixed(2)} m/s</b>`:''):(ductVelocity>0?`적용풍량 기준 덕트 평균 유속 약 <b>${ductVelocity.toFixed(2)} m/s</b>. `:''))}${english?'Duct conditions alone do not determine actual airflow. Use the manufacturer operating point or a field measurement.':(foreign?'':'덕트 조건만으로 실제 풍량을 확정할 수 없습니다. 제조사 성능곡선의 운전점 풍량 또는 현장 실측값을 적용하십시오.')}</div>
      </details>
    </td>`;
    tbody.appendChild(advancedTr);
  });

  document.getElementById('fan-total-supply').textContent = totalSupply.toFixed(1) + ' ㎥/h';

  const summary = document.getElementById('fan-summary');
  if(requiredQ<=0){
    summary.innerHTML = foreign?detail.noRequired:'4단계에서 필요환기량이 먼저 산출되어야 합니다.';
  } else if(state.fans.length===0){
    summary.innerHTML = foreign?detail.noEquipment:'등록된 장비가 없습니다. "장비 추가" 버튼으로 보유 송배풍기를 등록하십시오.';
  } else {
    const margin = ((totalSupply/requiredQ)-1)*100;
    const badge = totalSupply>=requiredQ
      ? `<span class="badge ok">${foreign?detail.meets:'충족'} (${foreign?detail.reserve:'여유율'} ${margin.toFixed(1)}%)</span>`
      : `<span class="badge bad">${foreign?detail.shortfall:'부족'} (${(requiredQ-totalSupply).toFixed(1)} ㎥/h)</span>`;
    let timingLine = '';
    if(state.result && state.result.mode==='A' && totalSupply>0){
      const purgeMinutes = (state.result.initial / totalSupply) * 60;
      timingLine = foreign
        ? (english?`<div style="margin-top:8px;">With the planned continuous airflow of ${formatV04Number(totalSupply,1)} ㎥/h, the initial purge (${state.result.initial.toFixed(1)} ㎥) takes about <b>${purgeMinutes.toFixed(1)} min</b>. Keep the blower running continuously afterward.</div>`:`<div style="margin-top:8px;">${labels.initial}: ${state.result.initial.toFixed(1)} ㎥ → <b>${purgeMinutes.toFixed(1)} min</b></div>`)
        : `<div style="margin-top:8px;">현재 계획 장비(연속가동, 총 ${formatV04Number(totalSupply,1)} ㎥/h)로 <b>최초 급기(${state.result.initial.toFixed(1)}㎥)</b>를 완료하는 데 약 <b>${purgeMinutes.toFixed(1)}분</b> 소요됩니다. 이후에는 <b>팬을 끄지 않고</b> 동일하게 연속 가동하여 유지환기량을 충족하십시오.</div>`;
    } else if(state.result && state.result.mode==='A'){
      timingLine = `<div style="margin-top:8px;">${foreign?(english?'The planned supply airflow is zero, so the initial purge time cannot be calculated.':labels.supply+' = 0'):'계획 공급풍량이 0이어서 최초 급기 소요시간을 계산할 수 없습니다.'}</div>`;
    } else if(state.result && (state.result.mode==='B' || state.result.mode==='C')){
      timingLine = computeSteadyStateLine(totalSupply);
    }
    summary.innerHTML = foreign
      ? `${english?'Minimum required airflow':labels.required} <b>${formatV04Number(requiredQ,1)} ㎥/h</b>; ${english?'planned supply airflow':labels.supply} <b>${formatV04Number(totalSupply,1)} ㎥/h</b> — ${badge}${timingLine}`
      : `필요환기량(최소 기준) <b>${formatV04Number(requiredQ,1)} ㎥/h 이상</b> 대비 현재 계획 공급풍량 <b>${formatV04Number(totalSupply,1)} ㎥/h</b> — ${badge}${timingLine}`;
  }
}

/* ------------------------------------------------------------
   정상상태(목표농도) 도달 예상 시간 계산 (희석법 B·C 공용)
   질량보존식: C(t) = Css + (C0-Css)e^(-Qt/V),  Css = G/Q
   ------------------------------------------------------------ */
function computeSteadyStateLine(totalSupplyQ){
  const V = state.volume;
  const foreign=currentUiLanguage!=='ko';
  const english=currentUiLanguage==='en';
  if(!state.result || totalSupplyQ<=0 || V<=0) {
    return `<div style="margin-top:8px;">${foreign?(english?'The planned airflow or space volume is missing, so the stabilization time cannot be calculated.':'Q = 0 / V = 0'):'계획 공급풍량 또는 체적이 없어 도달시간을 계산할 수 없습니다.'}</div>`;
  }
  const G = state.result.G || 0;
  let C0frac = 0, Callowfrac = 0;
  if(state.result.mode==='B'){
    C0frac = 0; // 발생 시작 시점을 청정 상태(0)로 가정
    Callowfrac = (parseFloat(document.getElementById('b-tlv').value)||0) * 1e-6;
  } else {
    // 모드 C: "지금부터" 실제 배치 장비로 몇 분 더 걸리는지 예측하는 것이므로,
    // 기준 시점(t=0)의 농도는 3단계의 초기농도(C0)가 아니라 마지막 측정농도 C(t)를 사용한다.
    C0frac = (parseFloat(document.getElementById('c-ct').value)||0) * 1e-6;
    Callowfrac = (parseFloat(document.getElementById('c-callow').value)||0) * 1e-6;
  }
  if(Callowfrac<=0){
    return `<div style="margin-top:8px;">${foreign?(english?'The target concentration has not been entered, so the stabilization time cannot be calculated.':'TLV = 0'):'목표(허용) 농도 기준이 입력되지 않아 도달시간을 계산할 수 없습니다.'}</div>`;
  }

  const Css = G / totalSupplyQ;                 // 이 풍량으로 계속 가동 시 도달하는 정상상태 농도 (fraction)
  const t95min = (3 * V / totalSupplyQ) * 60;    // 정상상태(약 95%) 도달 일반 목표치, 분 단위
  if(foreign && !english){
    let compact=`<div style="margin-top:8px;">3V/Q = <b>${t95min.toFixed(1)} min</b>; Css = ${(Css*1e6).toFixed(2)} ppm; TLV = ${(Callowfrac*1e6).toFixed(2)} ppm</div>`;
    if(Css>=Callowfrac) return compact+`<div class="note danger" style="margin-top:6px;">Css ≥ TLV</div>`;
    if(C0frac<=Callowfrac) return compact+`<div class="note ok" style="margin-top:6px;">C0 ≤ TLV; Css &lt; TLV</div>`;
    const tReachMin=-(V/totalSupplyQ)*Math.log((Callowfrac-Css)/(C0frac-Css))*60;
    return compact+`<div class="note ok" style="margin-top:6px;">C(t) ≤ TLV: <b>${tReachMin.toFixed(1)} min</b></div>`;
  }

  let html = foreign
    ? `<div style="margin-top:8px;">With continuous planned airflow of ${totalSupplyQ.toFixed(1)} ㎥/h, approximately <b>${t95min.toFixed(1)} min</b> is estimated to approach steady state. <span class="hint">(approximation: volume × 3 ÷ airflow; blower remains on)</span></div>`
    : `<div style="margin-top:8px;">현재 계획 장비(연속가동, 총 ${totalSupplyQ.toFixed(1)} ㎥/h) 기준, 농도가 <b>안정(정상상태)</b>되기까지 약 <b>${t95min.toFixed(1)}분</b> 소요될 것으로 예상됩니다. <span class="hint">(체적×3 ÷ 풍량 기준 근사치, 팬을 끄지 않고 연속 가동 전제)</span></div>`;

  if(Css >= Callowfrac){
    html += foreign
      ? `<div class="note danger" style="margin-top:6px;"><b>The target concentration cannot be reached with the current airflow.</b> The estimated steady-state concentration is ${(Css*1e6).toFixed(2)} ppm, above the target ${(Callowfrac*1e6).toFixed(2)} ppm. Increase airflow or add equipment.</div>`
      : `<div class="note danger" style="margin-top:6px;"><b>현재 공급풍량으로는 목표 농도 도달이 불가능합니다.</b> 이 풍량으로 계속 가동해도 정상상태 농도가 약 ${(Css*1e6).toFixed(2)}ppm으로, 목표 기준 ${(Callowfrac*1e6).toFixed(2)}ppm을 초과한 채 유지됩니다. 공급풍량을 늘리거나 장비를 추가하십시오.</div>`;
  } else if(C0frac <= Callowfrac){
    html += foreign
      ? `<div class="note ok" style="margin-top:6px;">The starting concentration is already below the target, and the estimated steady-state concentration (${(Css*1e6).toFixed(2)} ppm) also remains below it. Confirm by field measurement before entry.</div>`
      : `<div class="note ok" style="margin-top:6px;">초기농도가 이미 목표 이하이며, 이 풍량의 정상상태 농도(약 ${(Css*1e6).toFixed(2)}ppm)도 목표 이하로 유지될 것으로 예상됩니다. 별도 대기 없이도 농도가 목표를 넘지 않을 것으로 판단되나, 반드시 실측으로 재확인하십시오.</div>`;
  } else {
    const tReachMin = -(V/totalSupplyQ) * Math.log((Callowfrac-Css)/(C0frac-Css)) * 60;
    html += foreign
      ? `<div class="note ok" style="margin-top:6px;">The concentration is estimated to fall from ${(C0frac*1e6).toFixed(2)} ppm to the target ${(Callowfrac*1e6).toFixed(2)} ppm in about <b>${tReachMin.toFixed(1)} min</b>. Measure again before entry.</div>`
      : `<div class="note ok" style="margin-top:6px;">현재 농도(약 ${(C0frac*1e6).toFixed(2)}ppm)가 목표 기준(${(Callowfrac*1e6).toFixed(2)}ppm) 이하로 내려가기까지 약 <b>${tReachMin.toFixed(1)}분</b> 소요될 것으로 예상됩니다. 이 시간 경과 후에도 반드시 실측으로 확인한 뒤 출입시키십시오.</div>`;
  }
  return html;
}
/* ------------------------------------------------------------
   풍량 단위 변환기 (CMH 기준으로 환산 후 목표단위로 재환산)
   ------------------------------------------------------------ */
const UNIT_TO_CMH = {
  CMH: 1,
  CMM: 60,          // 1 ㎥/min = 60 ㎥/h
  Lmin: 0.06,       // 1 L/min = 0.06 ㎥/h
  CFM: 1.699011     // 1 CFM = 1.699011 ㎥/h
};
function toggleConverter(){
  const el = document.getElementById('unit-converter');
  el.style.display = (el.style.display==='none') ? 'block' : 'none';
}
function runConvert(){
  const v = parseFloat(document.getElementById('conv-value').value)||0;
  const from = document.getElementById('conv-from').value;
  const to = document.getElementById('conv-to').value;
  const cmh = v * UNIT_TO_CMH[from];
  const result = cmh / UNIT_TO_CMH[to];
  document.getElementById('conv-result').textContent = result.toFixed(3);
}
