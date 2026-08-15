function renderStepper(){
  const ul = document.getElementById('stepper');
  ul.innerHTML = '';
  getUiText()[5].forEach((label, i)=>{
    const n = i+1;
    const li = document.createElement('li');
    li.textContent = label;
    const span = document.createElement('span');
    span.className='num';
    span.textContent = n;
    li.prepend(span);
    if(n === state.step) li.classList.add('active');
    else if(n < state.step) li.classList.add('done');
    li.onclick = ()=>{ if(n <= state.step || canJump(n)) goStep(n); };
    ul.appendChild(li);
  });
  /* On narrow screens the step strip scrolls horizontally; keep the active target reachable. */
  ul.querySelector('.active')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
}
function canJump(n){
  // 이전에 필요한 최소 조건이 채워졌으면 자유 이동 허용
  if(n<=2) return true;
  if(n>=3 && !state.mode) return false;
  return true;
}
function goStep(n){
  if(n>1 && n>=3 && !state.mode){ alert(uiMsg('먼저 1단계에서 계산방식을 선택하십시오.','Select a calculation method in step 1 first.')); return; }
  state.step = n;
  document.querySelectorAll('.step').forEach(el=>{
    el.style.display = (parseInt(el.dataset.step)===n) ? 'block' : 'none';
  });
  renderStepper();
  if(n===3) renderStep3();
  if(n===4) computeAndRenderStep4();
  if(n===5) renderFanTable();
  if(n===6) renderReport();
  scrollV04StepIntoView(n);
}

/* ============================================================
   공용: ⓘ 클릭 시 설명 펼치기
============================================================ */
function toggleInfo(btn){
  let container = btn.parentElement; // <label> 또는 <p> 등 버튼을 감싸는 요소
  let box = container ? container.nextElementSibling : null;
  while(box && !box.classList.contains('info-box')) box = box.nextElementSibling;
  if(box){
    box.hidden = !box.hidden;
    if(!box.id)box.id=`info-box-${Array.from(document.querySelectorAll('.info-box')).indexOf(box)+1}`;
    btn.setAttribute('aria-controls',box.id);
    btn.setAttribute('aria-expanded',String(!box.hidden));
  }
}

/* ============================================================
   STEP 1 : 모드 선택
============================================================ */
