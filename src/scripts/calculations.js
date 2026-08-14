function renderStep3(){
  document.querySelectorAll('.mode-fields').forEach(f=>f.style.display='none');
  const sub = document.getElementById('step3-sub');
  const foreign=currentUiLanguage!=='ko';
  const full=foreign?getFullUiText():null;
  if(state.mode==='A'){
    document.getElementById('mode-A-fields').style.display='block';
    sub.textContent = foreign?full.step3SubA:'체적배수법: 최초 급기 배수 및 유지 환기횟수 기준을 입력하십시오.';
  } else if(state.mode==='B'){
    document.getElementById('mode-B-fields').style.display='block';
    sub.textContent = foreign?full.step3SubB:'희석법(발생량 입력): 물질 사용량과 허용기준을 입력하십시오.';
  } else if(state.mode==='C'){
    document.getElementById('mode-C-fields').style.display='block';
    sub.textContent = foreign?full.step3SubC:'희석법(측정 역산): 송풍 가동 후 측정한 농도 데이터를 입력하십시오.';
    document.getElementById('c-q').onchange =
    document.getElementById('c-t').onchange = checkReliability;
  }
}
function checkReliability(){
  const q = parseFloat(document.getElementById('c-q').value)||0;
  const tMin = parseFloat(document.getElementById('c-t').value)||0;  // 입력은 분(min) 단위
  const t = tMin/60; // 계산용 시간(h) 환산
  const v = state.volume||0;
  const box = document.getElementById('c-reliability');
  if(q<=0 || v<=0){ box.textContent=''; return; }
  const tminRecommendH = 3*v/q;
  const tminRecommendMin = tminRecommendH*60;
  const foreign=currentUiLanguage!=='ko';
  const full=foreign?getFullUiText():null;
  if(t < tminRecommendH){
    box.innerHTML = foreign
      ? `<span class="badge bad">${full.lowReliability}</span> 3V/Q ≥ ${tminRecommendMin.toFixed(1)} min; t = ${tMin} min`
      : `<span class="badge bad">신뢰도 낮음</span> 권장 최소 측정시간(3V/Q) = 약 ${tminRecommendMin.toFixed(1)}분 이상 경과 후 측정을 권장합니다. (현재 입력: ${tMin}분)`;
  } else {
    box.innerHTML = foreign
      ? `<span class="badge ok">${full.adequateTime}</span> 3V/Q = ${tminRecommendMin.toFixed(1)} min`
      : `<span class="badge ok">측정시간 적정</span> 권장 최소 측정시간(3V/Q) = 약 ${tminRecommendMin.toFixed(1)}분`;
  }
}

/* ============================================================
   STEP 4 : 계산
============================================================ */
function computeAndRenderStep4(){
  const V = state.volume || 0;
  const resultBox = document.getElementById('result-box');
  const formulaBox = document.getElementById('formula-box');
  const notesBox = document.getElementById('result-notes');
  const sub = document.getElementById('step4-sub');
  const foreign=currentUiLanguage!=='ko';
  const english=currentUiLanguage==='en';
  const pt=PRINT_I18N[currentUiLanguage] || PRINT_I18N.en;
  const full=foreign?getFullUiText():null;
  resultBox.innerHTML=''; formulaBox.textContent=''; notesBox.innerHTML='';

  if(V<=0){
    sub.textContent = foreign?full.noVolume:'체적이 입력되지 않았습니다. 2단계로 돌아가 체적을 입력하십시오.';
    return;
  }

  if(state.mode==='A'){
    const mult = parseFloat(document.getElementById('a-multiplier').value)||10;
    const ach = parseFloat(document.getElementById('a-ach').value)||20;
    const initial = V*mult;
    const sustained = V*ach;
    sub.textContent = foreign?full.resultA:'체적배수법 산출 결과';
    resultBox.innerHTML = metricHTML(foreign?full.initialResult:'최초 급기량 — 최소 기준 (사전 퍼지)', initial, '㎥') +
                           metricHTML(foreign?full.continuousResult:'유지 환기량 — 최소 기준 (연속 가동)', sustained, '㎥/h');
    formulaBox.textContent = foreign
      ? (english?`Initial purge [㎥] ≥ volume (${V.toFixed(2)}) × multiplier (${mult}) = ${initial.toFixed(2)} ㎥
Continuous airflow [㎥/h] ≥ volume (${V.toFixed(2)}) × ACH (${ach}) = ${sustained.toFixed(2)} ㎥/h`:`V × ${mult} = ${initial.toFixed(2)} ㎥
V × ${ach} ACH = ${sustained.toFixed(2)} ㎥/h`)
      : `최초 급기량[㎥]   ≥ 실내체적(${V.toFixed(2)}) × 급기배수(${mult})   = ${initial.toFixed(2)} ㎥  (이 값 "이상")
유지환기량[㎥/h] ≥ 실내체적(${V.toFixed(2)}) × 환기횟수(${ach})     = ${sustained.toFixed(2)} ㎥/h  (이 값 "이상")`;
    state.result = {mode:'A', initial, sustained, requiredQ: sustained};
    notesBox.innerHTML = foreign
      ? (english?`<div class="note">The initial purge time is calculated in step 5 from the actual planned supply airflow. Keep the blower running continuously during work.</div>`:'')
      : `<div class="note">참고: 현장에서 "20㎥/h 사양 팬으로 15분 급기"라는 관행을 들어보셨을 수 있습니다. 이는 과거 5배 기준(2021년 개정 전) 때의 산식이며, 현재 10배 기준으로는 <b>동일한 팬을 그대로 15분만 가동하면 목표치(10배)에 못 미칠 수 있습니다.</b> 정확한 소요시간은 5단계에서 실제 등록한 장비의 공급풍량 기준으로 자동 계산됩니다.</div>`;

  } else if(state.mode==='B'){
    const W = parseFloat(document.getElementById('b-w').value)||0;
    const M = parseFloat(document.getElementById('b-m').value)||0;
    const TLV = parseFloat(document.getElementById('b-tlv').value)||0;
    const K = parseFloat(document.getElementById('b-k').value)||1;
    let requiredQ = 0, molarFlow=0, G=0;
    if(M>0 && TLV>0){
      molarFlow = W / M;               // mol/h
      G = molarFlow * 0.02445;         // ㎥/h  (25℃, 1atm 몰부피 24.45 L/mol)
      const Cfrac = TLV * 1e-6;
      requiredQ = (G / Cfrac) * K;
    }
    sub.textContent = foreign?full.resultB:'희석법(발생량 입력) 산출 결과';
    resultBox.innerHTML = metricHTML(foreign?full.generationResult:'오염물질 발생 체적유량 (G)', G, '㎥/h') +
                           metricHTML(foreign?full.requiredResult:'필요환기량 — 최소 기준', requiredQ, '㎥/h');
    formulaBox.textContent = foreign
      ? (english?`Molar flow = W / M = ${W} / ${M} = ${molarFlow.toFixed(5)} mol/h
Generation volume G = molar flow × 24.45 L/mol ÷ 1000 = ${G.toFixed(5)} ㎥/h
Required airflow = G ÷ (TLV×10⁻⁶) × K = ${formatV04Number(requiredQ,2)} ㎥/h`:`W / M = ${molarFlow.toFixed(5)} mol/h
G = (W / M) × 24.45 ÷ 1000 = ${G.toFixed(5)} ㎥/h
Q = G ÷ (TLV×10⁻⁶) × K = ${formatV04Number(requiredQ,2)} ㎥/h`)
      : `몰유량           = W / M               = ${W} / ${M} = ${molarFlow.toFixed(5)} mol/h
발생 체적유량 G  = 몰유량 × 24.45L/mol÷1000 = ${G.toFixed(5)} ㎥/h
필요환기량       = G ÷ (TLV×10⁻⁶) × K   = ${formatV04Number(requiredQ,2)} ㎥/h`;
    notesBox.innerHTML = foreign
      ? (english?`<div class="note">This estimate uses the ideal-gas molar volume at 25°C and 1 atm. Confirm any legally required equipment formula separately.</div>`:'')
      : `<div class="note">본 계산은 25℃·1기압 기준 이상기체 몰부피(24.45 L/mol)를 사용한 일반 희석환기 원리입니다. 법정 설비 성능기준(안전보건규칙 제430조) 적용 시에는 원문 계산식과 반드시 재대조하십시오.</div>`;
    state.result = {mode:'B', requiredQ, G, molarFlow};

  } else if(state.mode==='C'){
    const Q = parseFloat(document.getElementById('c-q').value)||0;
    const tMin = parseFloat(document.getElementById('c-t').value)||0;  // 입력: 분(min)
    const t = tMin/60; // 계산용 시간(h)
    const C0 = (parseFloat(document.getElementById('c-c0').value)||0) * 1e-6;
    const Ct = (parseFloat(document.getElementById('c-ct').value)||0) * 1e-6;
    const Callow = (parseFloat(document.getElementById('c-callow').value)||0) * 1e-6;
    const K = parseFloat(document.getElementById('c-k').value)||1;

    let G=0, requiredQ=0, denom=0, reliable=true, tmin=0;
    if(Q>0 && V>0){
      const exponent = Math.exp(-(Q*t)/V);
      denom = 1 - exponent;
      tmin = 3*V/Q;
      reliable = t >= tmin;
      if(denom > 0.0001){
        G = Q * (Ct - C0*exponent) / denom;   // ㎥/h
      }
      if(Callow>0){
        requiredQ = (G / Callow) * K;
      }
    }
    sub.textContent = foreign?full.resultC:'희석법(측정 역산) 산출 결과';
    resultBox.innerHTML = metricHTML(foreign?full.generationResult:'역산된 발생 체적유량 (G)', G, '㎥/h') +
                           metricHTML(foreign?full.requiredResult:'필요환기량 — 최소 기준', requiredQ, '㎥/h');
    formulaBox.textContent = foreign
      ? (english?`Exponential term e^-(Qt/V) = ${Math.exp(-(Q*t)/V).toFixed(4)}
G = Q × [C(t) − C0×e^-(Qt/V)] / [1 − e^-(Qt/V)] = ${G.toFixed(5)} ㎥/h
Required airflow = G ÷ Callow × K = ${formatV04Number(requiredQ,2)} ㎥/h
Recommended minimum measurement time (3V/Q) = ${(tmin*60).toFixed(1)} min; input ${tMin} min`:`e^-(Qt/V) = ${Math.exp(-(Q*t)/V).toFixed(4)}
G = Q × [C(t) − C0×e^-(Qt/V)] ÷ [1 − e^-(Qt/V)] = ${G.toFixed(5)} ㎥/h
Q = G ÷ Callow × K = ${formatV04Number(requiredQ,2)} ㎥/h
3V/Q = ${(tmin*60).toFixed(1)} min; t = ${tMin} min`)
      : `Q×t/V 지수항 (e^-(Qt/V)) = ${Math.exp(-(Q*t)/V).toFixed(4)}
G = Q × [C(t) − C0×e^-(Qt/V)] / [1 − e^-(Qt/V)] = ${G.toFixed(5)} ㎥/h
필요환기량 = G ÷ Callow × K = ${formatV04Number(requiredQ,2)} ㎥/h
권장 최소 측정시간(3V/Q) = 약 ${(tmin*60).toFixed(1)}분  (입력값: ${tMin}분)`;

    if(!reliable){
      notesBox.innerHTML = foreign
        ? (english?`<div class="note danger"><b>Low estimate reliability.</b> The measurement time is shorter than 3V/Q and may underestimate generation. Repeat after a longer interval.</div><div class="note">This is a planning estimate and does not replace field measurement.</div>`:`<div class="note danger">t &lt; 3V/Q</div>`)
        : `<div class="note danger"><b>추정 신뢰도 낮음.</b> 측정시간이 권장 최소시간(3V/Q)에 못 미쳐 발생량이 과소 추정되었을 수 있습니다. 가능하면 더 긴 시간 경과 후 재측정을 권장합니다.</div>
      <div class="note">본 결과는 실측을 대체할 수 없는 <b>설계 참고용 추정치</b>입니다.</div>`;
    } else {
      notesBox.innerHTML = foreign
        ? (english?`<div class="note">This is a planning estimate and does not replace field measurement. Apply a conservative margin.</div>`:'')
        : `<div class="note">본 결과는 실측을 대체할 수 없는 <b>설계 참고용 추정치</b>입니다. 발생량이 시간에 따라 변할 수 있으므로 보수적으로(여유 있게) 적용하십시오.</div>`;
    }
    state.result = {mode:'C', requiredQ, G, reliable, tmin, t};
  }
}
function metricHTML(label, value, unit, decimals){
  const d = (decimals!==undefined) ? decimals : ((Math.abs(value) > 0 && Math.abs(value) < 0.01) ? 5 : 2);
  return `<div class="metric"><div class="label">${label}</div><div class="value">${(value||0).toFixed(d)} <span class="unit">${unit}</span></div></div>`;
}

/* ============================================================
   STEP 5 : 송배풍기 매칭
============================================================ */
function getRequiredQ(){
  if(!state.result) return 0;
  if(state.result.mode==='A') return state.result.sustained;
  return state.result.requiredQ || 0;
}
