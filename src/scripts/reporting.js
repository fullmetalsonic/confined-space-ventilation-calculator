function modeName(m){
  return {A:'체적배수법', B:'희석법 (발생량 직접입력)', C:'희석법 (농도 측정 기반 역산)'}[m] || '-';
}
function renderReport(){
  const body = document.getElementById('report-body');
  const r = state.result || {};
  const requiredQ = getRequiredQ();
  const workers = document.getElementById('worker-count').value || '-';
  const spaceName = document.getElementById('space-name').value || '';
  const now = new Date();
  const dateStr = typeof formatV04Date==='function' ? formatV04Date(now) : now.toISOString().slice(0,10);
  const formatCriterionNumber = value=>{
    const number = Number(value);
    if(!Number.isFinite(number)) return '-';
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  };
  const criterionValue = r.mode==='A'
    ? `최초 ${formatCriterionNumber(document.getElementById('a-multiplier')?.value || 10)}배 · 작업 중 ${formatCriterionNumber(document.getElementById('a-ach')?.value || 20)}회/h`
    : `희석환기식 · 안전계수 K=${formatCriterionNumber(document.getElementById(r.mode==='C'?'c-k':'b-k')?.value || 1)}`;

  document.getElementById('print-title').innerHTML =
    `<span class="pt-title-wrap"><small class="pt-kicker">작업 전 환기 검토</small><strong>밀폐공간 환기량 사전검토 결과서</strong></span>
     <span class="pt-sub"><b>사전검토용 · 현장 측정 필수</b>${spaceName ? `<span>${escapeReportText(spaceName)}</span>` : ''}<span>작성일 ${dateStr}</span></span>`;

  let modeSpecific = '';
  if(r.mode==='A'){
    modeSpecific = `
      <div class="kv"><div>최초 급기량</div><div>${r.initial.toFixed(2)} ㎥ (연속가동 총 공급풍량 기준 소요시간 별도 표기)</div></div>
      <div class="kv"><div>유지 환기량</div><div>${r.sustained.toFixed(2)} ㎥/h (팬을 끄지 않고 연속 가동 유지)</div></div>`;
  } else if(r.mode==='B'){
    modeSpecific = `
      <div class="kv"><div>오염물질 발생 체적유량</div><div>${formatV04Number(r.G||0,4)} ㎥/h</div></div>
      <div class="kv"><div>필요환기량(최소 기준)</div><div>${formatV04Number(r.requiredQ||0,2)} ㎥/h 이상</div></div>`;
  } else if(r.mode==='C'){
    modeSpecific = `
      <div class="kv"><div>역산된 발생 체적유량</div><div>${formatV04Number(r.G||0,4)} ㎥/h</div></div>
      <div class="kv"><div>필요환기량(최소 기준)</div><div>${formatV04Number(r.requiredQ||0,2)} ㎥/h 이상</div></div>
      <div class="kv"><div>측정 신뢰도</div><div>${r.reliable? '적정':'낮음 (권장 최소시간 미달)'}</div></div>`;
  }

  let fanRows = '';
  state.fans.forEach(f=>{
    const effective = getFanEffective(f);
    const needQty = effective>0? Math.ceil(requiredQ/effective):0;
    const basis = f.flowMethod==='estimate' ? `유효율 ${f.eff}%` : `${fanMethodLabel(f.flowMethod)} ${f.appliedFlow||0}㎥/h`;
    const advanced = [f.staticPressure?`${f.staticPressure}Pa`:'',f.ductDiameter?`Ø${f.ductDiameter}mm`:'',f.ductLength?`${f.ductLength}m`:'',f.bendCount?`굴곡 ${f.bendCount}`:''].filter(Boolean).join(' · ');
    fanRows += `<tr><td data-label="장비명">${escapeV04(f.name||'-')}${advanced?`<div class="hint">${advanced}</div>`:''}</td><td data-label="정격풍량(㎥/h)">${f.rated}</td><td data-label="풍량근거">${basis}</td><td data-label="방폭">${f.explosion?'O':'-'}</td><td data-label="적용풍량(㎥/h)">${effective.toFixed(1)}</td><td data-label="계획대수">${f.qty}</td><td data-label="필요대수">${needQty}</td></tr>`;
  });
  const totalSupply = state.fans.reduce((s,f)=>s+getFanEffective(f)*f.qty,0);
  const margin = requiredQ>0 ? (((totalSupply/requiredQ)-1)*100).toFixed(1) : '-';
  const supplyOk = requiredQ>0 && totalSupply>=requiredQ;

  const sections = [];

  sections.push(`<div class="print-overview-grid">
    <div class="print-overview-item date"><span>작성일</span><b>${dateStr}</b></div>
    <div class="print-overview-item space"><span>공간명</span><b>${escapeReportText(spaceName || '-')}</b></div>
    <div class="print-overview-item workers"><span>작업 인원수</span><b>${escapeReportText(workers)}</b></div>
    <div class="print-overview-item method"><span>계산방식</span><b>${modeName(r.mode)}</b></div>
    <div class="print-overview-item volume"><span>공간 체적(V)</span><b>${formatV04Number(state.volume,2)} ㎥</b></div>
    <div class="print-overview-item criteria"><span>적용 환기기준</span><b>${formatV04Criterion(criterionValue)}</b></div>
  </div>`);

  sections.push(modeSpecific || '<p>산출된 결과가 없습니다.</p>');

  sections.push(`<div class="print-key-metrics">
      <div><span>최소 필요환기량</span><strong>${formatV04Number(requiredQ,1)}</strong><small>㎥/h 이상</small></div>
      <div><span>계획 공급풍량</span><strong>${formatV04Number(totalSupply,1)}</strong><small>㎥/h</small></div>
      <div><span>여유율</span><strong>${margin}</strong><small>%</small></div>
      <div class="print-status ${supplyOk?'ok':'bad'}"><span>계획 판정</span><strong>${supplyOk?'충족':'부족'}</strong><small>${supplyOk?'현장 측정 후 승인':'장비계획 재검토'}</small></div>
    </div>
    <table class="responsive-table report-equipment-table">
      <colgroup>
        <col style="width:22%;"><col style="width:13%;"><col style="width:18%;">
        <col style="width:8%;"><col style="width:15%;"><col style="width:12%;"><col style="width:12%;">
      </colgroup>
      <thead><tr><th>장비명</th><th>정격풍량(㎥/h)</th><th>풍량 근거</th><th>방폭</th><th>적용풍량(㎥/h)</th><th>계획대수</th><th>필요대수</th></tr></thead>
      <tbody>${fanRows || '<tr><td colspan="7">등록된 장비 없음</td></tr>'}</tbody>
    </table>
    <div class="print-redundant-summary">
      <div class="kv"><div>필요환기량(최소 기준)</div><div>${formatV04Number(requiredQ,2)} ㎥/h 이상</div></div>
      <div class="kv"><div>계획 총 공급풍량</div><div>${formatV04Number(totalSupply,2)} ㎥/h</div></div>
      <div class="kv"><div>여유율</div><div>${margin}%</div></div>
    </div>
    ${(r.mode==='A' && totalSupply>0) ? `<div class="kv"><div>최초 급기 소요시간</div><div>약 ${((r.initial/totalSupply)*60).toFixed(1)} 분 (연속 가동 유지)</div></div>` : ''}`);

  if(r.mode==='B' || r.mode==='C'){
    sections.push(computeSteadyStateLine(totalSupply));
  }

  sections.push(buildV04PermitChecklistHTML(r.mode));

  sections.push(buildV04SafetyNotice());

  sections.push(buildV04ReferenceHTML(r.mode));

  const titles = ['산정 개요','필요환기량 산출 결과','송배풍기 매칭 계획'];
  if(r.mode==='B' || r.mode==='C') titles.push('정상상태(목표농도) 도달 예상 시간');
  titles.push('작업허가자·안전관리자 최종 확인','안전 고지','참고 기준 및 출처');

  const renderReportSection = (html,i) =>
    `<section class="report-section report-section-${i+1}"><h3><span class="section-num">${i+1}</span><span>${titles[i]}</span></h3>${html}</section>`;
  const tailStart = Math.max(0, sections.length-2);
  body.innerHTML = sections.slice(0,tailStart).map(renderReportSection).join('\n')
    + `<div class="report-tail">${sections.slice(tailStart).map((html,i)=>renderReportSection(html,tailStart+i)).join('\n')}</div>`
    + `<div class="print-document-footer"><span>${APP_VERSION}</span><span>계산 결과는 현장 측정과 사업장 작업허가 절차를 대체하지 않습니다.</span></div>`;
  renderTranslatedReports();
}

function buildPermitChecklistHTML(){
  return `
    <div class="permit-checklist">
      <div class="permit-check">
        <div class="permit-check-head"><span class="check-num">1</span><span class="permit-check-title"><b>측정·기록</b><small>O₂·CO₂·CO·H₂S·LEL 및 작업별 유해물질</small></span></div>
        <div class="permit-subcheck"><b>□ 측정·기록</b><span>작업 시작·재개 전 대상가스를 측정하고 결과·측정자·일시·장소 기록</span></div>
        <div class="permit-subcheck"><b>□ 센서·측정자</b><span>지정 측정자, 교정·범프테스트, 센서 종류·유효기간, 상·중·하부 측정 확인</span></div>
      </div>
      <div class="permit-check">
        <div class="permit-check-head"><span class="check-num">2</span><span class="permit-check-title"><b>격리·환기</b><small>배관·동력원 차단 후 작업 전·중 계속 환기</small></span></div>
        <div class="permit-subcheck"><b>□ 격리·LOTO</b><span>연결 배관·밸브·동력원 차단, 잠금·표지, 유입·누출 가능성 제거</span></div>
        <div class="permit-subcheck"><b>□ 환기설비</b><span>필요풍량·정압·덕트 배치, 전원·손상, 방폭 적합성, 작업 중 계속 가동 확인</span></div>
      </div>
      <div class="permit-check">
        <div class="permit-check-head"><span class="check-num">3</span><span class="permit-check-title"><b>허가·감시</b><small>출입 전 확인사항 게시, 외부 감시인·연락설비</small></span></div>
        <div class="permit-subcheck"><b>□ 작업정보·인원</b><span>장소·내용·시간, 관리감독자·작업자·감시인, 입·퇴장 인원 확인</span></div>
        <div class="permit-subcheck"><b>□ 출입통제·감시</b><span>허가내용 출입구 게시, 출입금지 표지, 외부 감시인과 상시 연락설비 확인</span></div>
      </div>
      <div class="permit-check">
        <div class="permit-check-head"><span class="check-num">4</span><span class="permit-check-title"><b>구조·대피</b><small>구조장비 사전 배치, 무보호 진입구조 금지</small></span></div>
        <div class="permit-subcheck"><b>□ 보호구·구조</b><span>호흡보호구·안전대·구명줄·삼각대·사다리·구조장비와 구조방법 확인</span></div>
        <div class="permit-subcheck"><b>□ 비상·작업중지</b><span>경보·이상징후 시 즉시 중지·대피, 신고·응급처치·무보호 구조금지 공유</span></div>
      </div>
    </div>
    <p class="hint">□ 측정·평가 기록은 3년 보존　□ 확인사항은 작업 종료까지 출입구 게시　□ 구조훈련은 6개월마다 실시·기록</p>
  `;
}

/* ------------------------------------------------------------
   리포트 하단 "참고 기준 및 출처" 섹션 (인쇄 1장 기준, 현재 기준값만 표기)
   법령 / KOSHA 기술지침(권장 최소기준) / 사업장 결정값을 구분해 표기
   ------------------------------------------------------------ */
function buildReferenceHTML(mode){
  const guideLine = (mode==='A')
    ? `최초 급기 체적 10배 이상 · 작업 중 20회/h 이상 계속 환기`
    : `이상기체 몰부피(24.45 L/mol) 기반 일반 희석환기식 사용. 물질별 MSDS·노출기준과 안전계수 별도 확인`;

  return `
    <table class="report-source-table">
      <colgroup><col style="width:20%;"><col style="width:80%;"></colgroup>
      <tbody>
        <tr><td>적정공기<br>(제618조)</td><td>O₂ 18% 이상 23.5% 미만 · CO₂ 1.5% 미만 · CO 30ppm 미만 · H₂S 10ppm 미만</td></tr>
        <tr><td>가연성가스</td><td>LEL 10% 미만(KOSHA·작업허가 관리기준). 화기작업은 별도 허가·연속 확인</td></tr>
        <tr><td>작업허가<br>(제619조)</td><td>작업·인원·측정결과·유입가능성·보호구·비상연락 확인 및 작업 종료까지 출입구 게시</td></tr>
        <tr><td>측정·기록<br>(제619조의2)</td><td>작업 시작·재개 전 지정된 측정자가 평가, 결과·측정자·일시·장소를 기록하여 3년 보존</td></tr>
        <tr><td>현장조치<br>(제620~625조)</td><td>작업 전·중 환기, 인원점검, 출입금지, 감시인·연락설비, 보호구·대피용 기구</td></tr>
        <tr><td>비상조치<br>(제639·640조)</td><td>위험 시 즉시 작업중지·대피, 비상연락·구조장비·호흡보호구·응급처치 훈련 6개월 주기</td></tr>
        <tr><td>KOSHA GUIDE<br>H-80-2021</td><td>${guideLine}</td></tr>
      </tbody>
    </table>
    <p class="hint">목표농도·안전계수(K)·유효율은 법정 고정값이 아니라 MSDS, 위험성평가, 설비조건과 사업장 승인기준에 따라 결정합니다. 측정기의 센서 구성이 대상가스를 실제로 검지하는지 확인하십시오.</p>
  `;
}

/* ------------------------------------------------------------
   다국어 인쇄 보조 페이지
   - 현재 화면 언어를 기본 결과서로 사용하고 선택 언어마다 별도 문서를 생성
   - 선택한 언어마다 인쇄 시 새 페이지를 추가
   ------------------------------------------------------------ */
const PRINT_I18N = {
  en:{
    name:'English', title:'Confined Space Ventilation Pre-Review',
    subtitle:'Supplementary Translation', disclaimer:'This translation is provided only to aid understanding. If there is any difference, the Korean original and the company standard procedure prevail.',
    h:['Basic Information','Ventilation Plan','Ventilation Equipment Plan','Pre-work Review Points','Safety Notice'],
    l:{date:'Date',space:'Work space',method:'Calculation method',volume:'Space volume',workers:'Workers',required:'Minimum required airflow',initial:'Initial purge volume',continuous:'Continuous airflow during work',supply:'Planned total airflow',margin:'Reserve margin',equipment:'Equipment',rated:'Rated airflow',basis:'Airflow basis',explosion:'Explosion-proof',applied:'Applied airflow',qty:'Planned quantity',prepared:'Prepared by',reviewed:'Reviewed by'},
    modes:{A:'Volume exchange method',B:'Dilution method (known generation rate)',C:'Dilution method (measurement-based estimate)'},
    methods:{estimate:'Simple efficiency correction',manufacturer:'Manufacturer operating point',measured:'Field-measured airflow'},
    checks:[
      ['Measurement and records','Check O₂, CO₂, CO, H₂S, LEL and task-specific hazards before entry or re-entry.'],
      ['Isolation and ventilation','Isolate pipes and energy sources, then maintain continuous ventilation before and during work.'],
      ['Permit and attendant','Post required information at the entrance and maintain an outside attendant and communication.'],
      ['Rescue and evacuation','Prepare rescue equipment in advance. Do not enter for rescue without respiratory protection.']
    ],
    safety:'This document is a pre-work ventilation planning reference. Never authorize entry based on calculations alone. Before entry or re-entry, measure and evaluate the atmosphere and follow the company work-permit procedure.'
  },
  zh:{
    name:'简体中文', title:'密闭空间通风量预审结果',
    subtitle:'辅助翻译页', disclaimer:'本译文仅用于帮助理解。如有差异，以韩文原件和公司标准程序为准。',
    h:['基本信息','通风计划','通风设备计划','作业前确认事项','安全提示'],
    l:{date:'编制日期',space:'作业空间',method:'计算方法',volume:'空间容积',workers:'作业人数',required:'最低所需风量',initial:'初始送风量',continuous:'作业中持续风量',supply:'计划总供风量',margin:'余量',equipment:'设备名称',rated:'额定风量',basis:'风量依据',explosion:'防爆',applied:'采用风量',qty:'计划台数',prepared:'编制人',reviewed:'确认人'},
    modes:{A:'体积换气法',B:'稀释法（已知发生量）',C:'稀释法（根据测量值推算）'},
    methods:{estimate:'简易效率修正',manufacturer:'制造商运行点',measured:'现场实测风量'},
    checks:[
      ['测量与记录','进入或重新进入前，确认 O₂、CO₂、CO、H₂S、LEL 及作业相关有害物质。'],
      ['隔离与通风','隔离管线和动力源，并在作业前及作业中保持连续通风。'],
      ['许可与监护','在入口张贴确认事项，设置外部监护人并保持通信。'],
      ['救援与撤离','提前配备救援器材。禁止在无呼吸防护的情况下进入救援。']
    ],
    safety:'本文件仅用于作业前通风计划审查。不得仅凭计算结果批准进入。进入或重新进入前，必须测量并评估空气状态，并遵守公司的作业许可程序。'
  },
  ja:{
    name:'日本語', title:'閉所作業 換気量事前検討結果',
    subtitle:'参考翻訳ページ', disclaimer:'この翻訳は理解を補助するためのものです。相違がある場合は、韓国語原本および会社の標準手順を優先します。',
    h:['基本情報','換気計画','送排風機計画','作業前確認事項','安全上の注意'],
    l:{date:'作成日',space:'作業場所',method:'計算方法',volume:'空間容積',workers:'作業人数',required:'最低必要風量',initial:'初期給気量',continuous:'作業中連続風量',supply:'計画総供給風量',margin:'余裕率',equipment:'機器名',rated:'定格風量',basis:'風量根拠',explosion:'防爆',applied:'適用風量',qty:'計画台数',prepared:'作成者',reviewed:'確認者'},
    modes:{A:'体積交換法',B:'希釈法（発生量既知）',C:'希釈法（測定値から推定）'},
    methods:{estimate:'簡易効率補正',manufacturer:'メーカー運転点',measured:'現場実測風量'},
    checks:[
      ['測定・記録','入場または再入場前に O₂、CO₂、CO、H₂S、LEL および作業別有害物質を確認します。'],
      ['隔離・換気','配管と動力源を隔離し、作業前および作業中は連続換気を維持します。'],
      ['許可・監視','入口に確認事項を掲示し、外部監視人と連絡手段を維持します。'],
      ['救助・避難','救助用具を事前に配置し、呼吸用保護具なしで救助のために進入しないでください。']
    ],
    safety:'本書は作業前の換気計画を検討するための参考資料です。計算結果だけで入場を許可しないでください。入場・再入場前に空気状態を測定・評価し、会社の作業許可手順に従ってください。'
  },
  vi:{
    name:'Tiếng Việt', title:'Kết quả xem xét sơ bộ thông gió trong không gian hạn chế',
    subtitle:'Trang dịch hỗ trợ', disclaimer:'Bản dịch này chỉ nhằm hỗ trợ việc hiểu nội dung. Nếu có khác biệt, bản tiếng Hàn và quy trình tiêu chuẩn của công ty được ưu tiên.',
    h:['Thông tin cơ bản','Kế hoạch thông gió','Kế hoạch thiết bị thông gió','Nội dung kiểm tra trước khi làm việc','Cảnh báo an toàn'],
    l:{date:'Ngày lập',space:'Không gian làm việc',method:'Phương pháp tính',volume:'Thể tích không gian',workers:'Số người làm việc',required:'Lưu lượng tối thiểu cần thiết',initial:'Thể tích cấp khí ban đầu',continuous:'Lưu lượng liên tục khi làm việc',supply:'Tổng lưu lượng dự kiến',margin:'Tỷ lệ dự phòng',equipment:'Thiết bị',rated:'Lưu lượng định mức',basis:'Cơ sở lưu lượng',explosion:'Chống nổ',applied:'Lưu lượng áp dụng',qty:'Số lượng dự kiến',prepared:'Người lập',reviewed:'Người kiểm tra'},
    modes:{A:'Phương pháp trao đổi thể tích',B:'Phương pháp pha loãng (biết lượng phát sinh)',C:'Phương pháp pha loãng (ước tính từ đo đạc)'},
    methods:{estimate:'Hiệu chỉnh hiệu suất đơn giản',manufacturer:'Điểm làm việc của nhà sản xuất',measured:'Lưu lượng đo tại hiện trường'},
    checks:[
      ['Đo và ghi chép','Kiểm tra O₂, CO₂, CO, H₂S, LEL và chất nguy hại theo công việc trước khi vào hoặc vào lại.'],
      ['Cô lập và thông gió','Cô lập đường ống, nguồn năng lượng và duy trì thông gió liên tục trước và trong khi làm việc.'],
      ['Giấy phép và giám sát','Niêm yết nội dung xác nhận tại lối vào, bố trí người giám sát bên ngoài và duy trì liên lạc.'],
      ['Cứu hộ và sơ tán','Chuẩn bị trước thiết bị cứu hộ. Không vào cứu hộ khi không có bảo vệ hô hấp.']
    ],
    safety:'Tài liệu này chỉ dùng để xem xét kế hoạch thông gió trước công việc. Không được cho phép vào chỉ dựa trên kết quả tính toán. Trước khi vào hoặc vào lại, phải đo và đánh giá không khí, đồng thời tuân theo quy trình giấy phép làm việc của công ty.'
  },
  th:{
    name:'ไทย', title:'ผลการทบทวนแผนระบายอากาศก่อนทำงานในที่อับอากาศ',
    subtitle:'หน้าแปลประกอบ', disclaimer:'คำแปลนี้จัดทำเพื่อช่วยให้เข้าใจเท่านั้น หากมีความแตกต่าง ให้ยึดเอกสารภาษาเกาหลีและขั้นตอนมาตรฐานของบริษัท',
    h:['ข้อมูลพื้นฐาน','แผนการระบายอากาศ','แผนอุปกรณ์ระบายอากาศ','รายการตรวจสอบก่อนทำงาน','คำเตือนด้านความปลอดภัย'],
    l:{date:'วันที่จัดทำ',space:'พื้นที่ทำงาน',method:'วิธีคำนวณ',volume:'ปริมาตรพื้นที่',workers:'จำนวนผู้ปฏิบัติงาน',required:'ปริมาณลมขั้นต่ำที่ต้องการ',initial:'ปริมาณลมเริ่มต้น',continuous:'ปริมาณลมต่อเนื่องระหว่างทำงาน',supply:'ปริมาณลมรวมตามแผน',margin:'อัตราสำรอง',equipment:'อุปกรณ์',rated:'ปริมาณลมพิกัด',basis:'ที่มาของปริมาณลม',explosion:'ป้องกันการระเบิด',applied:'ปริมาณลมที่ใช้',qty:'จำนวนตามแผน',prepared:'ผู้จัดทำ',reviewed:'ผู้ตรวจสอบ'},
    modes:{A:'วิธีเปลี่ยนถ่ายตามปริมาตร',B:'วิธีเจือจาง (ทราบอัตราการเกิด)',C:'วิธีเจือจาง (ประมาณจากการตรวจวัด)'},
    methods:{estimate:'ปรับค่าประสิทธิภาพแบบง่าย',manufacturer:'จุดทำงานจากผู้ผลิต',measured:'ปริมาณลมที่วัดจริงหน้างาน'},
    checks:[
      ['การตรวจวัดและบันทึก','ตรวจ O₂, CO₂, CO, H₂S, LEL และสารอันตรายเฉพาะงานก่อนเข้าและก่อนกลับเข้าไปทำงาน'],
      ['การแยกและระบายอากาศ','แยกท่อและแหล่งพลังงาน และระบายอากาศอย่างต่อเนื่องก่อนและระหว่างทำงาน'],
      ['การอนุญาตและผู้เฝ้าระวัง','ติดประกาศข้อมูลที่ทางเข้า จัดผู้เฝ้าระวังภายนอกและรักษาการสื่อสาร'],
      ['การกู้ภัยและอพยพ','เตรียมอุปกรณ์กู้ภัยล่วงหน้า ห้ามเข้าไปกู้ภัยโดยไม่มีอุปกรณ์ป้องกันระบบหายใจ']
    ],
    safety:'เอกสารนี้ใช้เป็นข้อมูลอ้างอิงสำหรับการวางแผนระบายอากาศก่อนทำงานเท่านั้น ห้ามอนุญาตให้เข้าโดยอาศัยผลคำนวณเพียงอย่างเดียว ก่อนเข้าและก่อนกลับเข้า ต้องตรวจวัดและประเมินอากาศ และปฏิบัติตามขั้นตอนใบอนุญาตทำงานของบริษัท'
  },
  id:{
    name:'Bahasa Indonesia', title:'Hasil Tinjauan Awal Ventilasi Ruang Terbatas',
    subtitle:'Halaman Terjemahan Pendukung', disclaimer:'Terjemahan ini hanya untuk membantu pemahaman. Jika terdapat perbedaan, dokumen asli bahasa Korea dan prosedur standar perusahaan yang berlaku.',
    h:['Informasi Dasar','Rencana Ventilasi','Rencana Peralatan Ventilasi','Pemeriksaan Sebelum Kerja','Peringatan Keselamatan'],
    l:{date:'Tanggal',space:'Ruang kerja',method:'Metode perhitungan',volume:'Volume ruang',workers:'Jumlah pekerja',required:'Aliran udara minimum',initial:'Volume purging awal',continuous:'Aliran udara kontinu saat bekerja',supply:'Total aliran udara rencana',margin:'Margin cadangan',equipment:'Peralatan',rated:'Aliran udara terukur',basis:'Dasar aliran udara',explosion:'Tahan ledakan',applied:'Aliran udara yang digunakan',qty:'Jumlah rencana',prepared:'Dibuat oleh',reviewed:'Diperiksa oleh'},
    modes:{A:'Metode pertukaran volume',B:'Metode pengenceran (laju timbulan diketahui)',C:'Metode pengenceran (perkiraan dari pengukuran)'},
    methods:{estimate:'Koreksi efisiensi sederhana',manufacturer:'Titik operasi pabrikan',measured:'Aliran udara hasil pengukuran lapangan'},
    checks:[
      ['Pengukuran dan catatan','Periksa O₂, CO₂, CO, H₂S, LEL dan bahaya khusus pekerjaan sebelum masuk atau masuk kembali.'],
      ['Isolasi dan ventilasi','Isolasi pipa dan sumber energi, lalu pertahankan ventilasi terus-menerus sebelum dan selama bekerja.'],
      ['Izin dan pengawas','Pasang informasi di pintu masuk serta sediakan pengawas luar dan komunikasi.'],
      ['Penyelamatan dan evakuasi','Siapkan peralatan penyelamatan. Jangan masuk untuk menolong tanpa pelindung pernapasan.']
    ],
    safety:'Dokumen ini hanya referensi perencanaan ventilasi sebelum kerja. Jangan mengizinkan masuk hanya berdasarkan hasil perhitungan. Sebelum masuk atau masuk kembali, ukur dan evaluasi udara serta ikuti prosedur izin kerja perusahaan.'
  },
  mn:{
    name:'Монгол', title:'Хаалттай орчны агааржуулалтын урьдчилсан үнэлгээ',
    subtitle:'Туслах орчуулга', disclaimer:'Энэ орчуулга нь зөвхөн ойлголтод туслах зориулалттай. Зөрүү гарвал солонгос эх хувь болон компанийн стандарт журмыг баримтална.',
    h:['Үндсэн мэдээлэл','Агааржуулалтын төлөвлөгөө','Агааржуулах төхөөрөмжийн төлөвлөгөө','Ажил эхлэхийн өмнөх шалгалт','Аюулгүй ажиллагааны анхааруулга'],
    l:{date:'Огноо',space:'Ажлын орон зай',method:'Тооцооны арга',volume:'Орон зайн эзлэхүүн',workers:'Ажилтны тоо',required:'Шаардлагатай хамгийн бага агаарын урсгал',initial:'Эхний үлээлтийн эзлэхүүн',continuous:'Ажлын үеийн тасралтгүй урсгал',supply:'Төлөвлөсөн нийт урсгал',margin:'Нөөц хувь',equipment:'Төхөөрөмж',rated:'Нэрлэсэн урсгал',basis:'Урсгалын үндэслэл',explosion:'Тэсрэлтээс хамгаалсан',applied:'Хэрэглэх урсгал',qty:'Төлөвлөсөн тоо',prepared:'Бэлтгэсэн',reviewed:'Хянасан'},
    modes:{A:'Эзлэхүүн солилцох арга',B:'Шингэрүүлэх арга (үүсэлтийн хэмжээ мэдэгдсэн)',C:'Шингэрүүлэх арга (хэмжилтэд тулгуурласан)'},
    methods:{estimate:'Энгийн үр ашгийн засвар',manufacturer:'Үйлдвэрлэгчийн ажлын цэг',measured:'Талбайд хэмжсэн агаарын урсгал'},
    checks:[
      ['Хэмжилт ба бүртгэл','Орох болон дахин орохын өмнө O₂, CO₂, CO, H₂S, LEL болон ажлын онцлог аюулыг шалгана.'],
      ['Тусгаарлалт ба агааржуулалт','Шугам хоолой, эрчим хүчний эх үүсвэрийг тусгаарлаж, ажлын өмнө ба явцад тасралтгүй агааржуулна.'],
      ['Зөвшөөрөл ба хяналт','Орох хэсэгт мэдээллийг байршуулж, гадна хянагч болон холбоог байнга хангана.'],
      ['Аврах ба нүүлгэн шилжүүлэх','Аврах хэрэгслийг урьдчилан бэлтгэнэ. Амьсгалын хамгаалалтгүйгээр аврахаар бүү ор.']
    ],
    safety:'Энэ баримт нь ажлын өмнөх агааржуулалтын төлөвлөлтийн лавлагаа юм. Зөвхөн тооцоонд үндэслэн орох зөвшөөрөл бүү олго. Орох болон дахин орохын өмнө агаарыг хэмжиж үнэлээд компанийн ажлын зөвшөөрлийн журмыг мөрдөнө.'
  },
  my:{
    name:'မြန်မာ', title:'ပိတ်လှောင်နေရာ လေဝင်လေထွက် ကြိုတင်သုံးသပ်ချက်',
    subtitle:'အထောက်အကူပြု ဘာသာပြန်စာမျက်နှာ', disclaimer:'ဤဘာသာပြန်သည် နားလည်ရန် အထောက်အကူအဖြစ်သာ ဖြစ်သည်။ ကွာခြားမှုရှိပါက ကိုရီးယားမူရင်းနှင့် ကုမ္ပဏီ၏ စံလုပ်ထုံးလုပ်နည်းကို ဦးစားပေးရမည်။',
    h:['အခြေခံအချက်အလက်','လေဝင်လေထွက်အစီအစဉ်','လေဝင်လေထွက်စက်ကိရိယာအစီအစဉ်','အလုပ်မစမီ စစ်ဆေးချက်များ','ဘေးကင်းရေးသတိပေးချက်'],
    l:{date:'ရက်စွဲ',space:'အလုပ်နေရာ',method:'တွက်ချက်နည်း',volume:'နေရာထုထည်',workers:'အလုပ်သမားဦးရေ',required:'အနည်းဆုံးလိုအပ်သော လေစီးနှုန်း',initial:'ကနဦးလေသွင်းထုထည်',continuous:'အလုပ်အတွင်း ဆက်တိုက်လေစီးနှုန်း',supply:'စီစဉ်ထားသော စုစုပေါင်းလေစီးနှုန်း',margin:'အပိုနှုန်း',equipment:'စက်ကိရိယာ',rated:'သတ်မှတ်လေစီးနှုန်း',basis:'လေစီးနှုန်းအခြေခံ',explosion:'ပေါက်ကွဲမှုကာကွယ်',applied:'အသုံးပြုလေစီးနှုန်း',qty:'စီစဉ်အရေအတွက်',prepared:'ပြုစုသူ',reviewed:'စစ်ဆေးသူ'},
    modes:{A:'ထုထည်လဲလှယ်နည်း',B:'ရောနှောလျော့ချနည်း (ထွက်ရှိနှုန်းသိ)',C:'ရောနှောလျော့ချနည်း (တိုင်းတာချက်အခြေခံ)'},
    methods:{estimate:'ရိုးရှင်းသော ထိရောက်မှုညှိနှိုင်း',manufacturer:'ထုတ်လုပ်သူ လည်ပတ်အမှတ်',measured:'လုပ်ငန်းခွင် တိုင်းတာလေစီးနှုန်း'},
    checks:[
      ['တိုင်းတာခြင်းနှင့် မှတ်တမ်း','ဝင်ရောက်ခြင်း သို့မဟုတ် ပြန်လည်ဝင်ရောက်ခြင်းမပြုမီ O₂, CO₂, CO, H₂S, LEL နှင့် အလုပ်ဆိုင်ရာအန္တရာယ်များကို စစ်ဆေးပါ။'],
      ['ခွဲထုတ်ခြင်းနှင့် လေဝင်လေထွက်','ပိုက်လိုင်းနှင့် စွမ်းအင်ရင်းမြစ်များကို ခွဲထုတ်ပြီး အလုပ်မစမီနှင့် အလုပ်အတွင်း ဆက်တိုက်လေသွင်းပါ။'],
      ['ခွင့်ပြုချက်နှင့် စောင့်ကြည့်သူ','ဝင်ပေါက်တွင် အချက်အလက်ကပ်ထားပြီး အပြင်ဘက်စောင့်ကြည့်သူနှင့် ဆက်သွယ်ရေးကို ထိန်းသိမ်းပါ။'],
      ['ကယ်ဆယ်ရေးနှင့် ထွက်ခွာရေး','ကယ်ဆယ်ရေးကိရိယာကို ကြိုတင်ပြင်ဆင်ပါ။ အသက်ရှူကာကွယ်ရေးမပါဘဲ ကယ်ဆယ်ရန် မဝင်ရောက်ပါနှင့်။']
    ],
    safety:'ဤစာတမ်းသည် အလုပ်မစမီ လေဝင်လေထွက်အစီအစဉ်အတွက် ရည်ညွှန်းချက်သာဖြစ်သည်။ တွက်ချက်ချက်တစ်ခုတည်းဖြင့် ဝင်ခွင့်မပြုပါနှင့်။ ဝင်ရောက်ခြင်း သို့မဟုတ် ပြန်လည်ဝင်ရောက်ခြင်းမပြုမီ လေထုကို တိုင်းတာအကဲဖြတ်ပြီး ကုမ္ပဏီ၏ အလုပ်ခွင့်ပြုလုပ်ထုံးလုပ်နည်းကို လိုက်နာပါ။'
  },
  km:{
    name:'ខ្មែរ', title:'លទ្ធផលពិនិត្យជាមុននៃការបញ្ចេញខ្យល់ក្នុងទីកន្លែងបិទជិត',
    subtitle:'ទំព័របកប្រែជំនួយ', disclaimer:'ការបកប្រែនេះសម្រាប់ជួយការយល់ដឹងប៉ុណ្ណោះ។ ប្រសិនបើមានភាពខុសគ្នា ត្រូវយកឯកសារភាសាកូរ៉េ និងនីតិវិធីស្តង់ដាររបស់ក្រុមហ៊ុនជាគោល។',
    h:['ព័ត៌មានមូលដ្ឋាន','ផែនការបញ្ចេញខ្យល់','ផែនការឧបករណ៍បញ្ចេញខ្យល់','ចំណុចត្រួតពិនិត្យមុនធ្វើការ','ការព្រមានសុវត្ថិភាព'],
    l:{date:'កាលបរិច្ឆេទ',space:'កន្លែងធ្វើការ',method:'វិធីគណនា',volume:'មាឌកន្លែង',workers:'ចំនួនកម្មករ',required:'លំហូរខ្យល់អប្បបរមា',initial:'មាឌខ្យល់ដំបូង',continuous:'លំហូរខ្យល់បន្តពេលធ្វើការ',supply:'លំហូរខ្យល់សរុបតាមផែនការ',margin:'អត្រាបម្រុង',equipment:'ឧបករណ៍',rated:'លំហូរខ្យល់កំណត់',basis:'មូលដ្ឋានលំហូរខ្យល់',explosion:'ការពារការផ្ទុះ',applied:'លំហូរខ្យល់ប្រើប្រាស់',qty:'ចំនួនតាមផែនការ',prepared:'អ្នករៀបចំ',reviewed:'អ្នកពិនិត្យ'},
    modes:{A:'វិធីប្តូរមាឌខ្យល់',B:'វិធីពង្រាវ (ដឹងអត្រាបង្កើត)',C:'វិធីពង្រាវ (ប៉ាន់ស្មានតាមការវាស់)'},
    methods:{estimate:'កែតម្រូវប្រសិទ្ធភាពសាមញ្ញ',manufacturer:'ចំណុចប្រតិបត្តិការរបស់ក្រុមហ៊ុនផលិត',measured:'លំហូរខ្យល់វាស់នៅទីតាំង'},
    checks:[
      ['ការវាស់ និងកត់ត្រា','ពិនិត្យ O₂, CO₂, CO, H₂S, LEL និងគ្រោះថ្នាក់តាមប្រភេទការងារ មុនចូល ឬចូលឡើងវិញ។'],
      ['ការផ្តាច់ និងបញ្ចេញខ្យល់','ផ្តាច់បំពង់ និងប្រភពថាមពល ហើយរក្សាការបញ្ចេញខ្យល់ជាបន្ត មុន និងក្នុងពេលធ្វើការ។'],
      ['ការអនុញ្ញាត និងអ្នកឃ្លាំមើល','បិទផ្សាយព័ត៌មាននៅច្រកចូល រៀបចំអ្នកឃ្លាំមើលខាងក្រៅ និងរក្សាការទំនាក់ទំនង។'],
      ['ការសង្គ្រោះ និងជម្លៀស','រៀបចំឧបករណ៍សង្គ្រោះជាមុន។ ហាមចូលសង្គ្រោះដោយគ្មានឧបករណ៍ការពារដង្ហើម។']
    ],
    safety:'ឯកសារនេះជាឯកសារយោងសម្រាប់ផែនការបញ្ចេញខ្យល់មុនធ្វើការប៉ុណ្ណោះ។ មិនត្រូវអនុញ្ញាតឱ្យចូលដោយផ្អែកលើលទ្ធផលគណនាតែប៉ុណ្ណោះ។ មុនចូល ឬចូលឡើងវិញ ត្រូវវាស់ និងវាយតម្លៃខ្យល់ ហើយអនុវត្តតាមនីតិវិធីលិខិតអនុញ្ញាតការងាររបស់ក្រុមហ៊ុន។'
  }
};

/* POSCO 그룹의 해외 사업국 언어를 위한 추가 보조 인쇄 페이지.
   공통 수치·장비 열은 국제 현장 식별성을 위해 영어 병기를 유지하고,
   제목·단계·핵심 안전문은 선택 언어로 표시한다. */
const SUPPLEMENTAL_PRINT_LABELS = {
  zht:['日期','作業空間','計算方法','空間體積','作業人數','最低所需風量','初始送風量','作業中持續風量','計畫總供風量','餘量','設備','額定風量','風量依據','防爆','採用風量','計畫數量','編製人','確認人'],
  ms:['Tarikh','Ruang kerja','Kaedah pengiraan','Isipadu ruang','Pekerja','Aliran udara minimum','Isipadu awal','Aliran berterusan','Jumlah bekalan dirancang','Margin simpanan','Peralatan','Aliran berkadar','Asas aliran','Kalis letupan','Aliran digunakan','Kuantiti','Disediakan oleh','Disemak oleh'],
  hi:['तारीख','कार्य स्थान','गणना विधि','स्थान आयतन','कर्मचारी','न्यूनतम वायु प्रवाह','प्रारंभिक शोधन','कार्य के दौरान निरंतर प्रवाह','नियोजित कुल प्रवाह','आरक्षित अंतर','उपकरण','रेटेड प्रवाह','प्रवाह आधार','विस्फोट-रोधी','लागू प्रवाह','नियोजित संख्या','तैयारकर्ता','समीक्षक'],
  bn:['তারিখ','কাজের স্থান','গণনা পদ্ধতি','স্থানের আয়তন','কর্মী','ন্যূনতম বায়ুপ্রবাহ','প্রাথমিক শোধন','কাজের সময় অবিরাম প্রবাহ','পরিকল্পিত মোট প্রবাহ','সংরক্ষিত মার্জিন','সরঞ্জাম','নির্ধারিত প্রবাহ','প্রবাহের ভিত্তি','বিস্ফোরণরোধী','প্রয়োগকৃত প্রবাহ','পরিকল্পিত সংখ্যা','প্রস্তুতকারী','পর্যালোচনাকারী'],
  fil:['Petsa','Lugar ng trabaho','Paraan ng pagkalkula','Dami ng espasyo','Manggagawa','Minimum na airflow','Paunang purge','Tuloy-tuloy na airflow','Planong kabuuang airflow','Reserbang margin','Kagamitan','Rated airflow','Batayan ng airflow','Explosion-proof','Inilapat na airflow','Planong dami','Inihanda ni','Sinuri ni'],
  es:['Fecha','Espacio de trabajo','Método de cálculo','Volumen del espacio','Trabajadores','Caudal mínimo','Purga inicial','Caudal continuo','Caudal total previsto','Margen de reserva','Equipo','Caudal nominal','Base del caudal','Antideflagrante','Caudal aplicado','Cantidad prevista','Preparado por','Revisado por'],
  pt:['Data','Espaço de trabalho','Método de cálculo','Volume do espaço','Trabalhadores','Vazão mínima','Purga inicial','Vazão contínua','Vazão total planejada','Margem de reserva','Equipamento','Vazão nominal','Base da vazão','À prova de explosão','Vazão aplicada','Quantidade planejada','Preparado por','Revisado por'],
  ar:['التاريخ','مكان العمل','طريقة الحساب','حجم المكان','العمال','الحد الأدنى لتدفق الهواء','التطهير الأولي','التدفق المستمر أثناء العمل','إجمالي التدفق المخطط','هامش الاحتياط','المعدات','التدفق المقنن','أساس التدفق','مقاوم للانفجار','التدفق المطبق','الكمية المخططة','إعداد','مراجعة'],
  ru:['Дата','Рабочее пространство','Метод расчета','Объем пространства','Работники','Минимальный расход','Начальная продувка','Постоянный расход','Плановый общий расход','Резерв','Оборудование','Номинальный расход','Основание расхода','Взрывозащита','Принятый расход','Количество','Подготовил','Проверил'],
  pl:['Data','Przestrzeń pracy','Metoda obliczeń','Objętość przestrzeni','Pracownicy','Minimalny przepływ','Początkowe przewietrzanie','Przepływ ciągły','Planowany przepływ całkowity','Margines rezerwy','Urządzenie','Przepływ znamionowy','Podstawa przepływu','Przeciwwybuchowe','Przyjęty przepływ','Planowana liczba','Opracował','Sprawdził'],
  tr:['Tarih','Çalışma alanı','Hesap yöntemi','Alan hacmi','Çalışanlar','Asgari hava debisi','İlk süpürme','Sürekli hava debisi','Planlanan toplam debi','Yedek pay','Ekipman','Anma debisi','Debi dayanağı','Patlamaya dayanıklı','Uygulanan debi','Planlanan adet','Hazırlayan','Kontrol eden'],
  uk:['Дата','Робочий простір','Метод розрахунку','Об’єм простору','Працівники','Мінімальна витрата','Початкова продувка','Постійна витрата','Планова загальна витрата','Резерв','Обладнання','Номінальна витрата','Підстава витрати','Вибухозахист','Прийнята витрата','Кількість','Підготував','Перевірив'],
  de:['Datum','Arbeitsraum','Berechnungsmethode','Raumvolumen','Beschäftigte','Mindestluftmenge','Erstspülung','Kontinuierlicher Luftstrom','Geplanter Gesamtluftstrom','Reserve','Ausrüstung','Nennluftstrom','Luftstromgrundlage','Explosionsgeschützt','Angesetzter Luftstrom','Geplante Anzahl','Erstellt von','Geprüft von'],
  fr:['Date','Espace de travail','Méthode de calcul','Volume de l’espace','Travailleurs','Débit minimal','Purge initiale','Débit continu','Débit total prévu','Marge de réserve','Équipement','Débit nominal','Base du débit','Antidéflagrant','Débit appliqué','Quantité prévue','Préparé par','Vérifié par'],
  it:['Data','Spazio di lavoro','Metodo di calcolo','Volume dello spazio','Lavoratori','Portata minima','Spurgo iniziale','Portata continua','Portata totale prevista','Margine di riserva','Attrezzatura','Portata nominale','Base della portata','Antideflagrante','Portata applicata','Quantità prevista','Preparato da','Verificato da'],
  cs:['Datum','Pracovní prostor','Metoda výpočtu','Objem prostoru','Pracovníci','Minimální průtok','Počáteční proplach','Trvalý průtok','Plánovaný celkový průtok','Rezerva','Zařízení','Jmenovitý průtok','Základ průtoku','Nevýbušné','Použitý průtok','Plánovaný počet','Vypracoval','Zkontroloval'],
  ro:['Data','Spațiu de lucru','Metodă de calcul','Volumul spațiului','Lucrători','Debit minim','Purjare inițială','Debit continuu','Debit total planificat','Marjă de rezervă','Echipament','Debit nominal','Baza debitului','Antiexploziv','Debit aplicat','Cantitate planificată','Întocmit de','Verificat de'],
  hu:['Dátum','Munkatér','Számítási módszer','Térfogat','Dolgozók','Minimális légáram','Kezdeti átöblítés','Folyamatos légáram','Tervezett teljes légáram','Tartalék','Berendezés','Névleges légáram','Légáram alapja','Robbanásbiztos','Alkalmazott légáram','Tervezett darab','Készítette','Ellenőrizte'],
  fa:['تاریخ','فضای کار','روش محاسبه','حجم فضا','کارگران','حداقل جریان هوا','تخلیه اولیه','جریان پیوسته','کل جریان برنامه‌ریزی‌شده','حاشیه ذخیره','تجهیزات','جریان نامی','مبنای جریان','ضدانفجار','جریان اعمال‌شده','تعداد برنامه‌ریزی‌شده','تهیه‌کننده','بازبین'],
  ur:['تاریخ','کام کی جگہ','حساب کا طریقہ','جگہ کا حجم','کارکن','کم از کم ہوا کا بہاؤ','ابتدائی صفائی','مسلسل ہوا کا بہاؤ','منصوبہ شدہ کل بہاؤ','محفوظ مارجن','آلات','درجہ بند بہاؤ','بہاؤ کی بنیاد','دھماکہ مزاحم','لاگو بہاؤ','منصوبہ شدہ تعداد','تیار کنندہ','جائزہ کنندہ'],
  kk:['Күні','Жұмыс кеңістігі','Есептеу әдісі','Кеңістік көлемі','Жұмысшылар','Ең аз ауа ағыны','Алғашқы үрлеу','Үздіксіз ауа ағыны','Жоспарланған жалпы ағын','Резерв','Жабдық','Номиналды ағын','Ағын негізі','Жарылыстан қорғалған','Қолданылған ағын','Жоспарланған саны','Дайындаған','Тексерген'],
  uz:['Sana','Ish joyi','Hisoblash usuli','Joy hajmi','Ishchilar','Minimal havo oqimi','Dastlabki tozalash','Uzluksiz havo oqimi','Rejalashtirilgan jami oqim','Zaxira','Uskuna','Nominal oqim','Oqim asosi','Portlashdan himoyalangan','Qo‘llangan oqim','Rejalashtirilgan soni','Tayyorladi','Tekshirdi']
};
function makeSupplementalPrintPack(code){
  const u=getUiText(code);
  const f=getFullUiText(code);
  const meta=UI_LANGUAGE_META.find(x=>x[0]===code);
  const en=PRINT_I18N.en;
  const keys=['date','space','method','volume','workers','required','initial','continuous','supply','margin','equipment','rated','basis','explosion','applied','qty','prepared','reviewed'];
  const labels={...en.l};
  (SUPPLEMENTAL_PRINT_LABELS[code]||[]).forEach((value,index)=>{labels[keys[index]]=value;});
  return {
    name:meta ? meta[2] : code,
    title:u[0],
    subtitle:'',
    disclaimer:u[4],
    h:[u[6][1],u[6][3],u[6][4],u[12] || en.h[3],u[3]],
    l:labels,
    modes:{
      A:`${u[5][0]} A · V×ACH`,
      B:`${u[5][0]} B · W/M/TLV`,
      C:`${u[5][0]} C · Q/C(t)`
    },
    methods:{
      estimate:`${labels.applied} (%)`,
      manufacturer:`${labels.rated} / ΔP`,
      measured:`${labels.applied} (Q)`
    },
    checks:[
      [f.check1Title,f.check1Desc],
      [f.check2Title,f.check2Desc],
      [f.check3Title,f.check3Desc],
      [f.check4Title,f.check4Desc]
    ],
    safety:u[4]
  };
}
PRINT_LANG_CODES.forEach(code=>{
  if(!PRINT_I18N[code]) PRINT_I18N[code]=makeSupplementalPrintPack(code);
  PRINT_I18N[code].subtitle='';
  PRINT_I18N[code].disclaimer=getUiText(code)[4];
});

function getSelectedPrintLanguages(){
  return Array.from(document.querySelectorAll('input[name="print-lang"]:checked')).map(el=>el.value);
}
function escapeReportText(value){
  return String(value===undefined || value===null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const PRINT_CRITERIA_I18N = {
  en:{label:'Applied criterion',volume:(m,a)=>`Initial ${m}× · During work ${a} ACH`,dilution:k=>`Dilution equation · Safety factor K=${k}`},
  zh:{label:'适用通风标准',volume:(m,a)=>`初始送风 ${m} 倍 · 作业中 ${a} 次/h`,dilution:k=>`稀释通风公式 · 安全系数 K=${k}`},
  ja:{label:'適用換気基準',volume:(m,a)=>`初期給気 ${m}倍 · 作業中 ${a}回/h`,dilution:k=>`希釈換気式 · 安全係数 K=${k}`},
  vi:{label:'Tiêu chí áp dụng',volume:(m,a)=>`Ban đầu ${m} lần · Khi làm việc ${a} lần/h`,dilution:k=>`Công thức pha loãng · Hệ số an toàn K=${k}`},
  th:{label:'เกณฑ์การระบายอากาศ',volume:(m,a)=>`เริ่มต้น ${m} เท่า · ระหว่างทำงาน ${a} ครั้ง/ชม.`,dilution:k=>`สมการเจือจาง · ค่าความปลอดภัย K=${k}`},
  id:{label:'Kriteria yang diterapkan',volume:(m,a)=>`Awal ${m} kali · Saat bekerja ${a} kali/jam`,dilution:k=>`Persamaan pengenceran · Faktor keselamatan K=${k}`},
  mn:{label:'Хэрэглэх шалгуур',volume:(m,a)=>`Эхний ${m} дахин · Ажлын үед ${a} удаа/цаг`,dilution:k=>`Шингэрүүлэлтийн томьёо · Аюулгүйн K=${k}`},
  my:{label:'အသုံးပြု စံနှုန်း',volume:(m,a)=>`ကနဦး ${m} ဆ · အလုပ်ချိန် ${a} ကြိမ်/နာရီ`,dilution:k=>`ရောနှောလျော့ချမှု တွက်ချက်ပုံ · ဘေးကင်းရေး K=${k}`},
  km:{label:'លក្ខណៈវិនិច្ឆ័យអនុវត្ត',volume:(m,a)=>`ដំបូង ${m} ដង · ពេលធ្វើការ ${a} ដង/ម៉ោង`,dilution:k=>`សមីការបន្សាប · កត្តាសុវត្ថិភាព K=${k}`}
};

function renderTranslatedReports(){
  const host = document.getElementById('translated-reports');
  if(!host) return;
  const selected = getSelectedPrintLanguages();
  if(!selected.length){ host.innerHTML=''; return; }

  const r = state.result || {};
  const requiredQ = getRequiredQ();
  const totalSupply = state.fans.reduce((sum,f)=>sum+getFanEffective(f)*(parseFloat(f.qty)||0),0);
  const margin = requiredQ>0 ? (((totalSupply/requiredQ)-1)*100).toFixed(1)+'%' : '-';
  const workers = document.getElementById('worker-count').value || '-';
  const spaceName = document.getElementById('space-name').value || '-';
  const now = new Date();
  const dateStr = typeof formatV04Date==='function' ? formatV04Date(now) : now.toISOString().slice(0,10);
  const formatCriterionNumber = value=>{
    const number = Number(value);
    if(!Number.isFinite(number)) return '-';
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  };
  const multiplier = formatCriterionNumber(document.getElementById('a-multiplier')?.value || 10);
  const ach = formatCriterionNumber(document.getElementById('a-ach')?.value || 20);
  const safetyFactor = formatCriterionNumber(document.getElementById(r.mode==='C'?'c-k':'b-k')?.value || 1);

  host.innerHTML = selected.map(code=>{
    const t = PRINT_I18N[code];
    if(!t) return '';
    const full = getFullUiText(code);
    const languageLabel=typeof v05BilingualLanguageName==='function'
      ? v05BilingualLanguageName(code,currentUiLanguage)
      : (UI_LANGUAGE_META.find(item=>item[0]===code)?.[2]||code);
    const ci = PRINT_CRITERIA_I18N[code] || PRINT_CRITERIA_I18N.en;
    const criterionText = r.mode==='A' ? ci.volume(multiplier,ach) : ci.dilution(safetyFactor);
    const fanRows = state.fans.map(f=>{
      const effective = getFanEffective(f);
      return `<tr><td>${escapeReportText(f.name||'-')}</td><td>${Number(f.rated||0).toFixed(1)}</td><td>${t.methods[f.flowMethod||'estimate']}</td><td>${f.explosion?'O':'-'}</td><td>${effective.toFixed(1)}</td><td>${Number(f.qty||0)}</td></tr>`;
    }).join('') || `<tr><td colspan="6">-</td></tr>`;
    let ventilationRows = '';
    if(r.mode==='A'){
      ventilationRows = `<div class="kv"><div>${t.l.initial}</div><div>${Number(r.initial||0).toFixed(2)} ㎥</div></div><div class="kv"><div>${t.l.continuous}</div><div>${Number(r.sustained||0).toFixed(2)} ㎥/h</div></div>`;
    } else {
      ventilationRows = `<div class="kv"><div>${t.l.required}</div><div>${Number(requiredQ||0).toFixed(2)} ㎥/h</div></div>`;
    }
    const checks = t.checks.map(c=>`<div class="translated-check"><b>□ ${c[0]}</b>${c[1]}</div>`).join('');
    const translatedOk = requiredQ>0 && totalSupply>=requiredQ;
    return `<section class="translated-report" lang="${escapeReportText(localeV04For(code))}" data-language="${code}">
      <div class="translated-title"><span class="translated-title-main">${t.title}</span><small><b>${escapeReportText(languageLabel)}</b><br>${APP_VERSION}</small></div>
      <div class="translated-disclaimer">${t.disclaimer}</div>
      <h3><span>1</span>${t.h[0]}</h3>
      <div class="translated-overview-grid">
        <div class="kv date"><div>${t.l.date}</div><div>${dateStr}</div></div>
        <div class="kv space"><div>${t.l.space}</div><div>${escapeReportText(spaceName)}</div></div>
        <div class="kv workers"><div>${t.l.workers}</div><div>${escapeReportText(workers)}</div></div>
        <div class="kv method"><div>${t.l.method}</div><div>${t.modes[r.mode]||'-'}</div></div>
        <div class="kv volume"><div>${t.l.volume}</div><div>${Number(state.volume||0).toFixed(2)} ㎥</div></div>
        <div class="kv criteria"><div>${ci.label}</div><div>${criterionText}</div></div>
      </div>
      <h3><span>2</span>${t.h[1]}</h3>${ventilationRows}
      <div class="kv"><div>${t.l.supply}</div><div>${formatV04Number(totalSupply,2)} ㎥/h</div></div>
      <div class="kv"><div>${t.l.margin}</div><div>${margin}</div></div>
      <div class="translated-key-metrics">
        <div><span>${t.l.required}</span><b>${formatV04Number(requiredQ,1)} ㎥/h</b></div>
        <div><span>${t.l.supply}</span><b>${formatV04Number(totalSupply,1)} ㎥/h</b></div>
        <div><span>${t.l.margin}</span><b>${margin}</b></div>
        <div class="${translatedOk?'ok':'bad'}"><span>${full.status}</span><b>${translatedOk?'OK':full.review}</b></div>
      </div>
      <h3><span>3</span>${t.h[2]}</h3>
      <table class="translated-equipment-table"><thead><tr><th>${t.l.equipment}</th><th>${t.l.rated}</th><th>${t.l.basis}</th><th>${t.l.explosion}</th><th>${t.l.applied}</th><th>${t.l.qty}</th></tr></thead><tbody>${fanRows}</tbody></table>
      <h3><span>4</span>${t.h[3]}</h3><div class="translated-checks">${checks}</div>
      <h3><span>5</span>${t.h[4]}</h3><div class="note danger">${t.safety}</div>
      <div class="translated-document-footer"><span>${APP_VERSION}</span><span>${escapeReportText(languageLabel)}</span></div>
    </section>`;
  }).join('');
}

/* ============================================================
   공간별 세션 저장 / 불러오기 (다중 밀폐공간 이력 관리)
   화면에 입력된 모든 값을 JSON으로 내보내고, 다시 불러와 복원한다.
============================================================ */
