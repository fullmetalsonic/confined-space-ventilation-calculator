function serializeSession(){
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  return {
    fileFormat: 'confined-space-session',
    version: 3,
    spaceName: g('space-name'),
    savedAt: new Date().toISOString(),
    mode: state.mode,
    workerCount: g('worker-count'),
    spaceRatio: g('space-ratio'),
    zones: state.zones.map(z => ({
      name: z.name, shape: z.shape, sign: z.sign,
      vals: z.vals, polyPoints: z.polyPoints, polyH: z.polyH
    })),
    inputs: {
      aMultiplier: g('a-multiplier'), aAch: g('a-ach'),
      bW: g('b-w'), bM: g('b-m'), bTlv: g('b-tlv'), bK: g('b-k'),
      cQ: g('c-q'), cT: g('c-t'), cC0: g('c-c0'), cCt: g('c-ct'), cCallow: g('c-callow'), cK: g('c-k')
    },
    printLanguages: getSelectedPrintLanguages(),
    fans: state.fans.map(f => ({
      name:f.name, rated:f.rated, eff:f.eff,
      flowMethod:f.flowMethod||'estimate', appliedFlow:f.appliedFlow||0,
      ductDiameter:f.ductDiameter||0, ductLength:f.ductLength||0,
      bendCount:f.bendCount||0, staticPressure:f.staticPressure||0,
      advancedNote:f.advancedNote||'',
      explosion:f.explosion, qty:f.qty
    }))
  };
}

function restoreSession(data){
  if(!data || typeof data !== 'object'){ alert(uiMsg('올바른 세션 파일이 아닙니다.','This is not a valid session file.')); return; }
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = (val!==undefined && val!==null) ? val : ''; };

  set('space-name', data.spaceName);
  set('worker-count', data.workerCount);
  set('space-ratio', data.spaceRatio!==undefined ? data.spaceRatio : 100);

  // 구버전(v1) 세션 호환: 단일 도형 필드를 구역 1개로 변환
  if(data.zones && data.zones.length){
    state.zones = data.zones.map(z => ({
      id: state.zoneIdSeq++,
      name: z.name||'', shape: z.shape||'box', sign: z.sign===-1?-1:1,
      vals: z.vals||{}, polyPoints: z.polyPoints||[], polyH: z.polyH||'', volume:0
    }));
  } else if(data.inputs && (data.inputs.vDirect || data.inputs.boxL || data.inputs.cylR || data.inputs.polyPoints)){
    const oldShape = data.shape || 'direct';
    const oi = data.inputs;
    let vals = {};
    if(oldShape==='direct') vals = {v: parseFloat(oi.vDirect)||0};
    else if(oldShape==='box') vals = {l:parseFloat(oi.boxL)||0, w:parseFloat(oi.boxW)||0, h:parseFloat(oi.boxH)||0};
    else if(oldShape==='cyl') vals = {r:parseFloat(oi.cylR)||0, h:parseFloat(oi.cylH)||0};
    state.zones = [{
      id: state.zoneIdSeq++, name:'', shape: (oldShape==='poly'?'poly':oldShape), sign:1,
      vals, polyPoints: oi.polyPoints||[], polyH: oi.polyH||'', volume:0
    }];
  } else {
    state.zones = [];
  }

  const inp = data.inputs || {};
  set('a-multiplier', inp.aMultiplier!==undefined ? inp.aMultiplier : 10);
  set('a-ach', inp.aAch!==undefined ? inp.aAch : 20);
  set('b-w', inp.bW); set('b-m', inp.bM); set('b-tlv', inp.bTlv);
  set('b-k', inp.bK!==undefined ? inp.bK : 2);
  set('c-q', inp.cQ); set('c-t', inp.cT);
  set('c-c0', inp.cC0!==undefined ? inp.cC0 : 0);
  set('c-ct', inp.cCt); set('c-callow', inp.cCallow);
  set('c-k', inp.cK!==undefined ? inp.cK : 2);
  const savedLanguages = Array.isArray(data.printLanguages) ? data.printLanguages : [];
  document.querySelectorAll('input[name="print-lang"]').forEach(el=>{
    el.checked = savedLanguages.includes(el.value);
  });

  state.fans = (data.fans || []).map(f => ({
    id: state.fanIdSeq++,
    name: f.name || '', rated: f.rated || 0,
    eff: f.eff!==undefined ? f.eff : 75,
    flowMethod: f.flowMethod || 'estimate',
    appliedFlow: f.appliedFlow || 0,
    ductDiameter: f.ductDiameter || 0,
    ductLength: f.ductLength || 0,
    bendCount: f.bendCount || 0,
    staticPressure: f.staticPressure || 0,
    advancedNote: f.advancedNote || '',
    advancedOpen: false,
    explosion: !!f.explosion, qty: f.qty || 0
  }));

  if(data.mode) selectMode(data.mode);
  if(state.zones.length===0) addZone();
  else renderZones();
  renderFanTable();
  renderTranslatedReports();
  goStep(1);
}

function saveSessionToFile(){
  const data = serializeSession();
  const jsonStr = JSON.stringify(data, null, 2);
  const nameSafe = (data.spaceName || '밀폐공간').replace(/[\\/:*?"<>|]/g,'_').trim() || '밀폐공간';
  const dateSafe = data.savedAt.slice(0,10);
  const filename = `세션_${nameSafe}_${dateSafe}.json`;
  downloadOrSave(filename, jsonStr, 'application/json');
}

function loadSessionFromFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try{
      const data = JSON.parse(evt.target.result);
      restoreSession(data);
    }catch(err){
      alert(uiMsg('세션 파일을 읽을 수 없습니다. 파일이 손상되었거나 형식이 올바르지 않습니다.','The session file cannot be read. It may be damaged or use an invalid format.'));
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}


/* ============================================================
   v0.5 GLOBAL SAFETY EXTENSION
   UI language and jurisdiction are intentionally independent.
============================================================ */
const V05_REGULATORY_DATA={"schemaVersion":1,"contentReviewBaseline":"2026-07-31","profiles":{"kr":{"label":"대한민국 · KOSHA H-80-2021","scope":"Republic of Korea","noteKo":"대한민국 사전검토 프로필입니다. 현재 체적 10배·작업 중 20회/h 기본값을 사용하되, 최신 법령·KOSHA GUIDE와 사업장 작업허가 절차를 반드시 대조하십시오.","noteEn":"Korea planning profile. The current defaults are 10 space volumes for initial purge and 20 ACH during work. Verify current law, KOSHA guidance and company procedures.","source":"산업안전보건기준에 관한 규칙 제618~625조 / KOSHA GUIDE H-80-2021","url":"https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025460863","extraSources":[["KOSHA GUIDE 검색","https://smartsearch.kosha.or.kr/"]],"reviewedAt":"2026-07-31","reviewer":"미지정 — 현지 EHS 검토 필요","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"공식 출처 기반 사전검토 데이터이며, 사업장 현지 EHS의 승인·적용 판단은 별도 필요","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"ymd"},"rows":[["O₂","18–23.5 vol%"],["CO₂","< 1.5 vol%"],["CO","< 30 ppm"],["H₂S","< 10 ppm"],["Flammable","< 10% LEL"],["Planning ventilation","Initial ≥10× volume · During work ≥20 ACH (KOSHA GUIDE H-80-2021)"]],"clauses":"산업안전보건기준에 관한 규칙 제618~625조 · KOSHA GUIDE H-80-2021"},"us-general":{"label":"United States · OSHA 29 CFR 1910.146","scope":"United States general industry","noteKo":"미국 일반산업 허가필요 밀폐공간 프로필입니다. OSHA 1910.146은 이 도구의 10배·20 ACH를 법정값으로 정하지 않습니다. 사업장 위험평가·공학 기준을 입력하고 진입 전 및 작업 중 허용조건을 시험·감시하십시오.","noteEn":"US general-industry permit-space profile. OSHA 1910.146 does not make this tool’s 10-volume or 20-ACH defaults a legal requirement. Use site engineering criteria and test/monitor acceptable entry conditions.","source":"OSHA 29 CFR 1910.146","url":"https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.146","extraSources":[],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"Letter","resultUnit":"us","inputUnit":"us","dateFormat":"mdy"},"rows":[["O₂","19.5–23.5 vol%"],["Flammable","Hazardous atmosphere when >10% LFL"],["Toxic","> applicable OSHA PEL = hazardous atmosphere"],["Test order","O₂ → flammable gases/vapors → potential toxic contaminants"],["Ventilation","No universal statutory ACH; verify acceptable entry conditions by testing and monitoring"]],"clauses":"OSHA 29 CFR 1910.146(c)–(k)"},"us-construction":{"label":"United States · OSHA 29 CFR 1926 Subpart AA","scope":"United States construction","noteKo":"미국 건설업 밀폐공간 프로필입니다. 고정 환기배수 대신 현장 위험평가, 허가공간 프로그램, 격리, 시험·감시 및 구조계획을 우선 적용하십시오.","noteEn":"US construction confined-space profile. Apply the site hazard evaluation, permit-space program, isolation, testing/monitoring and rescue provisions; no fixed ACH is inferred here.","source":"OSHA 29 CFR 1926 Subpart AA","url":"https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926subpartaa","extraSources":[],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"Letter","resultUnit":"us","inputUnit":"us","dateFormat":"mdy"},"rows":[["O₂","19.5–23.5 vol%"],["Flammable","Hazardous atmosphere when >10% LFL"],["Toxic","> applicable OSHA PEL = hazardous atmosphere"],["Monitoring","Continuous monitoring unless employer demonstrates periodic monitoring is sufficient"],["Ventilation","No universal statutory ACH; permit-space program and verified entry conditions govern"]],"clauses":"OSHA 29 CFR 1926.1203–1211"},"uk":{"label":"United Kingdom · Confined Spaces Regulations 1997 / HSE L101","scope":"United Kingdom","noteKo":"영국 프로필입니다. 가능한 경우 밀폐공간 진입을 피하고, 불가피한 진입에는 위험성평가에 따른 안전작업체계와 작업 전 비상조치를 적용하십시오. 이 프로필은 고정 ACH를 법정값으로 제시하지 않습니다.","noteEn":"United Kingdom profile. Avoid confined-space entry where possible; where entry is unavoidable, use a risk-assessed safe system of work and make adequate emergency arrangements before work starts. No fixed ACH is inferred.","source":"UK Confined Spaces Regulations 1997 / HSE ACOP L101","url":"https://www.hse.gov.uk/pubns/priced/l101.pdf","extraSources":[["HSE confined-space legislation","https://www.hse.gov.uk/confinedspace/legislation.htm"]],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"dmy"},"rows":[["O₂","Normal air ≈20.8 vol%; no single universal statutory entry band"],["Flammable","DSEAR risk assessment and safe system of work"],["Toxic","Applicable COSHH Workplace Exposure Limit (WEL)"],["Entry","Avoid entry where reasonably practicable"],["Emergency","Suitable and sufficient arrangements before work starts"]],"clauses":"Confined Spaces Regulations 1997, Reg. 4–5 · HSE ACOP L101"},"au":{"label":"Australia · WHS Regulations / Model Code of Practice","scope":"Australia model framework; state/territory confirmation required","noteKo":"호주 모델 기준 프로필입니다. 위험성평가·진입허가·격리·대기검사·감시·비상절차를 적용하십시오. Model Code의 법적 효력과 세부 요구사항은 해당 주·준주 규제기관에서 다시 확인해야 합니다.","noteEn":"Australian model profile. Apply risk assessment, entry permit, isolation, atmospheric testing/monitoring and emergency procedures. Confirm the Code’s legal effect and local requirements with the relevant state or territory regulator.","source":"Safe Work Australia Model Code of Practice: Confined spaces","url":"https://www.safeworkaustralia.gov.au/sites/default/files/2024-11/model_code_of_practice-confined_spaces-nov24.pdf","extraSources":[["Safe Work Australia landing page","https://www.safeworkaustralia.gov.au/doc/model-code-practice-confined-spaces"]],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"dmy"},"rows":[["O₂","19.5–23.5 vol%"],["Flammable","Target <5% LEL · 5–<10% requires calibrated continuous detector/withdrawal · ≥10% withdraw immediately"],["Toxic","< applicable Australian workplace exposure standard"],["Purge gas","Do not use pure oxygen or gas mixture >21% O₂"],["Legal effect","Confirm adoption and current requirements with the state/territory regulator"]],"clauses":"Model WHS Regulations 66–72 · Safe Work Australia Model Code, Nov 2024"},"sg":{"label":"Singapore · WSH (Confined Spaces) Regulations 2009","scope":"Singapore","noteKo":"싱가포르 프로필입니다. 진입허가, 안전평가자의 가스검사, 환기, 작업 중 감시·주기시험, 훈련된 감시인과 구조계획을 적용하십시오. 산소 19.5~23.5%, 가연성 10% LEL 미만 및 물질별 노출기준을 확인합니다.","noteEn":"Singapore profile. Apply entry permits, gas testing by a confined-space safety assessor, ventilation, monitoring/periodic testing, a trained attendant and rescue planning. Check oxygen 19.5–23.5%, flammables below 10% LEL and applicable toxic exposure limits.","source":"Singapore WSH (Confined Spaces) Regulations 2009","url":"https://sso.agc.gov.sg/SL/WSHA2006-S462-2009","extraSources":[],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"dmy"},"rows":[["O₂","19.5–23.5 vol%"],["Flammable","< 10% LEL"],["Toxic","≤ applicable permissible exposure level"],["Permit","Gas test by safety assessor and approval by authorised manager"],["Monitoring","Maintain ventilation; monitor and periodically retest during work"]],"clauses":"WSH (Confined Spaces) Regulations 2009, Reg. 4–23"},"jp":{"label":"Japan · Oxygen Deficiency Prevention Regulation","scope":"Japan — oxygen-deficiency hazardous work","noteKo":"일본 산소결핍 위험작업 사전검토 프로필입니다. 작업 전 산소(해당 시 황화수소)를 측정·기록하고, 작업 중 산소 18% 이상 및 제2종 작업의 황화수소 10 ppm 이하를 유지하도록 환기하십시오. 고정 ACH는 법정값으로 추정하지 않습니다.","noteEn":"Japan planning profile for oxygen-deficiency hazardous work. Measure and record oxygen (and H₂S where applicable) before work; ventilate to maintain oxygen at or above 18% and H₂S at or below 10 ppm for second-class work. No fixed ACH is inferred.","source":"Japan MHLW: Ordinance on Prevention of Oxygen Deficiency etc.","url":"https://www.mhlw.go.jp/web/t_doc?dataId=74105000&dataType=0&pageNo=1","extraSources":[],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"ymd"},"rows":[["O₂","≥ 18 vol%"],["H₂S","≤ 10 ppm for second-class oxygen-deficiency work"],["Before work","Measure O₂; for second-class work, measure O₂ and H₂S before each day’s work"],["Record","Record time, method, place, conditions, result, measurer and corrective measures; retain 3 years"],["Ventilation","Maintain O₂ ≥18%; for applicable second-class work also maintain H₂S ≤10 ppm"]],"clauses":"Oxygen Deficiency Prevention Regulation, Arts. 2–5"},"br":{"label":"Brazil · NR-33 Confined Spaces","scope":"Brazil","noteKo":"브라질 밀폐공간 사전검토 프로필입니다. NR-33에 따른 위험관리, 출입·작업허가(PET), 대기 조건 확인 및 비상대응 체계를 적용하십시오. 산소 20.9% 미만은 결핍, 23% 초과는 과잉으로 정의됩니다. 고정 ACH나 가연성 수치를 이 도구가 법정값으로 추정하지 않습니다.","noteEn":"Brazil planning profile. Apply NR-33 risk management, entry-and-work permit (PET), atmospheric-condition checks and emergency arrangements. Oxygen below 20.9% is deficient and above 23% is enriched. This tool does not infer a statutory fixed ACH or flammable threshold.","source":"Brazil Ministry of Labour and Employment: NR-33","url":"https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-33-nr-33","extraSources":[["NR-33 official PDF","https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-33.pdf/%40%40download/file"]],"reviewedAt":"2026-07-31","reviewer":"Unassigned — local EHS review required","nextReviewDue":"2027-01-31","profileVersion":"1.0","approvalStatus":"local-ehs-approval-pending","approvalNote":"Official-source planning data only; local site EHS approval and applicability review remain required.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"dmy"},"rows":[["O₂ deficient","< 20.9 vol%"],["O₂ enriched","> 23 vol%"],["Permit","PET (Permissão de Entrada e Trabalho) for confined-space work"],["Risk management","Apply NR-01 occupational risk-management programme to confined spaces"],["Atmosphere","Verify acceptable conditions before and throughout entry/work; control toxic and flammable hazards"]],"clauses":"NR-33, items 33.2–33.3"},"unverified":{"label":"Unverified local jurisdiction · local EHS review required","scope":"No verified local legal profile is supplied by this tool","noteKo":"현지 법규 프로필 미검증 — 회사 절차 및 현지 EHS 검토가 필수입니다. 이 도구의 수치·안내를 현지 법적 기준으로 사용하지 마십시오.","noteEn":"Local legal profile is unverified. Company procedure and local EHS review are mandatory. Do not treat this tool’s figures or guidance as local legal criteria.","source":"No verified local source supplied","url":"","extraSources":[],"reviewedAt":"","reviewer":"Unassigned — local EHS review required","nextReviewDue":"","profileVersion":"1.0","approvalStatus":"unverified","approvalNote":"No local legal research or local EHS approval is supplied by this tool.","regionalPreferences":{"paper":"A4","resultUnit":"si","inputUnit":"si","dateFormat":"locale"},"rows":[["Legal status","No verified local legal profile"],["Required action","Apply company procedure and obtain local EHS review before use"],["Atmosphere","Set acceptable conditions from applicable local law, SDS and work permit"],["Ventilation","Use a documented engineering basis and verify by testing/monitoring"]],"clauses":"Local legal profile not verified"}}};
const V04_PROFILES=V05_REGULATORY_DATA.profiles;

const V04_UI = {
  ko:['안전 기준 프로필','추가 회사 기준 문서·개정번호','인쇄 용지','입력값을 확인하십시오','다음 항목이 비어 있거나 허용 범위를 벗어났습니다'],
  en:['Safety jurisdiction profile','Additional company standard / revision','Print paper','Check the input values','The following values are missing or outside the allowed range'],
  zh:['安全法规配置','现场标准文件/修订版','打印纸张','请检查输入值','以下数值缺失或超出允许范围'],
  zht:['安全法規設定','現場標準文件／修訂版','列印紙張','請檢查輸入值','以下數值缺少或超出允許範圍'],
  ja:['安全基準プロファイル','事業所基準文書・改訂番号','印刷用紙','入力値を確認してください','次の値が未入力または許容範囲外です'],
  vi:['Hồ sơ pháp lý an toàn','Tài liệu tiêu chuẩn / bản sửa đổi','Khổ giấy in','Kiểm tra giá trị nhập','Các giá trị sau bị thiếu hoặc ngoài phạm vi'],
  th:['โปรไฟล์ข้อกำหนดความปลอดภัย','เอกสารมาตรฐาน/ฉบับแก้ไข','ขนาดกระดาษ','ตรวจสอบค่าที่ป้อน','ค่าต่อไปนี้ขาดหายหรืออยู่นอกช่วง'],
  id:['Profil yurisdiksi keselamatan','Dokumen standar/revisi lokasi','Kertas cetak','Periksa nilai masukan','Nilai berikut kosong atau di luar rentang'],
  ms:['Profil bidang kuasa keselamatan','Dokumen standard/semakan tapak','Kertas cetak','Semak nilai input','Nilai berikut tiada atau di luar julat'],
  hi:['सुरक्षा क्षेत्राधिकार प्रोफ़ाइल','साइट मानक दस्तावेज़/संशोधन','प्रिंट कागज़','इनपुट जाँचें','ये मान अनुपस्थित या सीमा से बाहर हैं'],
  bn:['নিরাপত্তা বিধি প্রোফাইল','সাইট মান নথি/সংশোধন','মুদ্রণ কাগজ','ইনপুট পরীক্ষা করুন','নিচের মান অনুপস্থিত বা সীমার বাইরে'],
  fil:['Profile ng hurisdiksiyong pangkaligtasan','Pamantayan/rebisyon ng site','Papel sa pag-print','Suriin ang input','Nawawala o wala sa saklaw ang mga sumusunod'],
  my:['ဘေးကင်းရေး စည်းမျဉ်း ပရိုဖိုင်','လုပ်ငန်းခွင် စံစာတမ်း/ပြင်ဆင်ချက်','ပုံနှိပ်စက္ကူ','ထည့်သွင်းချက် စစ်ဆေးပါ','အောက်ပါတန်ဖိုးများ မရှိ သို့မဟုတ် အကန့်အသတ်ကျော်လွန်သည်'],
  km:['ទម្រង់យុត្តាធិការសុវត្ថិភាព','ឯកសារស្តង់ដារ/កំណែប្រែ','ក្រដាសបោះពុម្ព','ពិនិត្យទិន្នន័យ','តម្លៃខាងក្រោមបាត់ ឬក្រៅដែនកំណត់'],
  es:['Perfil de jurisdicción de seguridad','Norma/revisión del centro','Papel de impresión','Revise los datos','Faltan o están fuera de rango los siguientes valores'],
  pt:['Perfil de jurisdição de segurança','Norma/revisão do local','Papel de impressão','Verifique os dados','Os seguintes valores estão ausentes ou fora do intervalo'],
  ar:['ملف الولاية التنظيمية للسلامة','وثيقة معيار الموقع/المراجعة','ورق الطباعة','تحقق من القيم','القيم التالية مفقودة أو خارج النطاق'],
  fa:['نمایه حوزه مقررات ایمنی','سند استاندارد/بازنگری سایت','کاغذ چاپ','ورودی‌ها را بررسی کنید','مقادیر زیر وارد نشده یا خارج از محدوده‌اند'],
  ur:['حفاظتی دائرۂ اختیار پروفائل','سائٹ معیار دستاویز/نظرثانی','پرنٹ کاغذ','درج شدہ قدریں جانچیں','درج ذیل قدریں غائب یا حد سے باہر ہیں'],
  ru:['Профиль юрисдикции безопасности','Стандарт площадки / редакция','Бумага','Проверьте ввод','Следующие значения отсутствуют или вне диапазона'],
  de:['Sicherheits-Rechtsprofil','Standortstandard / Revision','Druckpapier','Eingaben prüfen','Folgende Werte fehlen oder liegen außerhalb des Bereichs'],
  fr:['Profil réglementaire de sécurité','Norme du site / révision','Papier d’impression','Vérifiez les données','Les valeurs suivantes manquent ou sont hors limites'],
  mn:['Аюулгүй ажиллагааны эрх зүйн профайл','Талбайн стандарт / хувилбар','Хэвлэх цаас','Оруулгыг шалгана уу','Дараах утга байхгүй эсвэл хүрээнээс гадуур байна'],
  uk:['Профіль юрисдикції безпеки','Стандарт майданчика / редакція','Папір для друку','Перевірте введення','Значення відсутні або поза діапазоном'],
  pl:['Profil jurysdykcji bezpieczeństwa','Norma zakładowa / rewizja','Papier do druku','Sprawdź dane','Wartości są puste lub poza zakresem'],
  tr:['Güvenlik mevzuatı profili','Saha standardı / revizyon','Baskı kağıdı','Girdileri kontrol edin','Değerler eksik veya aralık dışında'],
  it:['Profilo normativo di sicurezza','Standard del sito / revisione','Carta di stampa','Controllare i dati','Valori mancanti o fuori intervallo'],
  cs:['Profil bezpečnostní jurisdikce','Norma pracoviště / revize','Papír pro tisk','Zkontrolujte vstupy','Hodnoty chybí nebo jsou mimo rozsah'],
  ro:['Profil de jurisdicție pentru siguranță','Standardul amplasamentului / revizia','Hârtie de imprimare','Verificați datele','Valorile lipsesc sau sunt în afara intervalului'],
  hu:['Biztonsági joghatósági profil','Telephelyi szabvány / verzió','Nyomtatási papír','Ellenőrizze a bevitt adatokat','Hiányzó vagy tartományon kívüli értékek'],
  kk:['Қауіпсіздік юрисдикциясы профилі','Алаң стандарты / нұсқасы','Баспа қағазы','Енгізуді тексеріңіз','Мәндер жоқ немесе ауқымнан тыс'],
  uz:['Xavfsizlik yurisdiksiyasi profili','Obyekt standarti / tahrir','Chop etish qog‘ozi','Kiritishni tekshiring','Qiymatlar yo‘q yoki diapazondan tashqarida']
};

/* Flow-method choices are interactive UI labels, not print-only text. */
const V04_FAN_METHODS = {
  ko:{estimate:'간편 효율 보정',manufacturer:'제조사 성능곡선 운전점',measured:'현장 실측 풍량'},
  en:{estimate:'Simple efficiency correction',manufacturer:'Manufacturer operating point',measured:'Field-measured airflow'},
  zh:{estimate:'简易效率修正',manufacturer:'制造商运行工况',measured:'现场实测风量'},
  zht:{estimate:'簡易效率修正',manufacturer:'製造商運轉工況',measured:'現場實測風量'},
  ja:{estimate:'簡易効率補正',manufacturer:'メーカー性能曲線の運転点',measured:'現場実測風量'},
  vi:{estimate:'Hiệu chỉnh hiệu suất đơn giản',manufacturer:'Điểm vận hành theo nhà sản xuất',measured:'Lưu lượng gió đo tại hiện trường'},
  th:{estimate:'การปรับแก้ประสิทธิภาพแบบง่าย',manufacturer:'จุดการทำงานตามผู้ผลิต',measured:'ปริมาณลมที่วัดหน้างาน'},
  id:{estimate:'Koreksi efisiensi sederhana',manufacturer:'Titik operasi pabrikan',measured:'Aliran udara terukur di lapangan'},
  ms:{estimate:'Pembetulan kecekapan ringkas',manufacturer:'Titik operasi pengilang',measured:'Aliran udara diukur di tapak'},
  hi:{estimate:'सरल दक्षता सुधार',manufacturer:'निर्माता परिचालन बिंदु',measured:'स्थल पर मापा गया वायु प्रवाह'},
  bn:{estimate:'সহজ দক্ষতা সংশোধন',manufacturer:'প্রস্তুতকারকের পরিচালন বিন্দু',measured:'স্থানে মাপা বায়ুপ্রবাহ'},
  fil:{estimate:'Simpleng pagwawasto ng kahusayan',manufacturer:'Punto ng pagpapatakbo ng tagagawa',measured:'Daloy ng hangin na sinusukat sa lugar'},
  my:{estimate:'ရိုးရှင်းသော ထိရောက်မှု ပြင်ဆင်ချက်',manufacturer:'ထုတ်လုပ်သူ လည်ပတ်အမှတ်',measured:'နေရာတွင် တိုင်းတာသော လေစီးနှုန်း'},
  km:{estimate:'ការកែតម្រូវប្រសិទ្ធភាពសាមញ្ញ',manufacturer:'ចំណុចប្រតិបត្តិការរបស់ក្រុមហ៊ុនផលិត',measured:'លំហូរខ្យល់វាស់នៅទីតាំង'},
  es:{estimate:'Corrección simple de eficiencia',manufacturer:'Punto de operación del fabricante',measured:'Caudal de aire medido en campo'},
  pt:{estimate:'Correção simples de eficiência',manufacturer:'Ponto de operação do fabricante',measured:'Vazão de ar medida em campo'},
  ar:{estimate:'تصحيح كفاءة مبسط',manufacturer:'نقطة تشغيل الشركة المصنّعة',measured:'تدفق الهواء المقاس ميدانيًا'},
  fa:{estimate:'اصلاح ساده راندمان',manufacturer:'نقطه کارکرد سازنده',measured:'جریان هوای اندازه‌گیری‌شده در محل'},
  ur:{estimate:'سادہ کارکردگی تصحیح',manufacturer:'سازندہ کا عملیاتی نقطہ',measured:'موقع پر ماپا گیا ہوا کا بہاؤ'},
  ru:{estimate:'Простая корректировка эффективности',manufacturer:'Рабочая точка производителя',measured:'Измеренный на месте расход воздуха'},
  de:{estimate:'Einfache Wirkungsgradkorrektur',manufacturer:'Betriebspunkt laut Hersteller',measured:'Vor Ort gemessener Luftvolumenstrom'},
  fr:{estimate:'Correction simple du rendement',manufacturer:'Point de fonctionnement constructeur',measured:'Débit d’air mesuré sur site'},
  mn:{estimate:'Энгийн үр ашгийн засвар',manufacturer:'Үйлдвэрлэгчийн ажлын цэг',measured:'Талбайд хэмжсэн агаарын урсгал'},
  uk:{estimate:'Проста поправка ефективності',manufacturer:'Робоча точка виробника',measured:'Виміряна на місці витрата повітря'},
  pl:{estimate:'Prosta korekta sprawności',manufacturer:'Punkt pracy producenta',measured:'Zmierzony na miejscu przepływ powietrza'},
  tr:{estimate:'Basit verim düzeltmesi',manufacturer:'Üretici çalışma noktası',measured:'Sahada ölçülen hava debisi'},
  it:{estimate:'Correzione semplice dell’efficienza',manufacturer:'Punto di funzionamento del produttore',measured:'Portata d’aria misurata in campo'},
  cs:{estimate:'Jednoduchá korekce účinnosti',manufacturer:'Provozní bod výrobce',measured:'Průtok vzduchu měřený na místě'},
  ro:{estimate:'Corecție simplă a eficienței',manufacturer:'Punct de funcționare al producătorului',measured:'Debit de aer măsurat la fața locului'},
  hu:{estimate:'Egyszerű hatásfok-korrekció',manufacturer:'Gyártói üzemi pont',measured:'Helyszínen mért légáram'},
  kk:{estimate:'Қарапайым тиімділік түзетуі',manufacturer:'Өндірушінің жұмыс нүктесі',measured:'Орнында өлшенген ауа шығыны'},
  uz:{estimate:'Oddiy samaradorlik tuzatishi',manufacturer:'Ishlab chiqaruvchi ish nuqtasi',measured:'Joyida o‘lchangan havo oqimi'}
};

const V04_TERMS = {
  ko:['표시 단위','공식 출처','프로필 안내','관할 기준·수치','현행 공식 원문을 사용 전에 확인하십시오.','계획 입력값(법정 고정값 아님)','생성일'],
  en:['Display units','Official source','Profile guidance','Jurisdiction criteria and limits','Verify the current official text before use.','Planning input (not a fixed statutory value)','Generated'],
  zh:['显示单位','官方来源','配置说明','适用法规标准与限值','使用前请核对现行官方原文。','规划输入值（非法定固定值）','生成日期'],
  zht:['顯示單位','官方來源','設定說明','適用法規標準與限值','使用前請核對現行官方原文。','規劃輸入值（非法定固定值）','產生日期'],
  ja:['表示単位','公式出典','プロファイル案内','管轄基準・数値','使用前に最新の公式原文を確認してください。','計画入力値（法定固定値ではありません）','作成日'],
  vi:['Đơn vị hiển thị','Nguồn chính thức','Hướng dẫn hồ sơ','Tiêu chí và giới hạn theo thẩm quyền','Hãy kiểm tra văn bản chính thức hiện hành trước khi sử dụng.','Giá trị lập kế hoạch, không phải giá trị pháp định cố định','Ngày tạo'],
  th:['หน่วยแสดงผล','แหล่งข้อมูลทางการ','คำแนะนำโปรไฟล์','เกณฑ์และค่าจำกัดตามเขตอำนาจ','ตรวจสอบข้อความทางการฉบับปัจจุบันก่อนใช้งาน','ค่าป้อนเพื่อการวางแผน ไม่ใช่ค่าคงที่ตามกฎหมาย','วันที่จัดทำ'],
  id:['Satuan tampilan','Sumber resmi','Panduan profil','Kriteria dan batas yurisdiksi','Periksa naskah resmi terkini sebelum digunakan.','Masukan perencanaan, bukan nilai tetap menurut hukum','Dibuat'],
  ms:['Unit paparan','Sumber rasmi','Panduan profil','Kriteria dan had bidang kuasa','Semak teks rasmi semasa sebelum digunakan.','Input perancangan, bukan nilai statutori tetap','Dijana'],
  hi:['प्रदर्शन इकाइयाँ','आधिकारिक स्रोत','प्रोफ़ाइल मार्गदर्शन','क्षेत्राधिकार मानदंड और सीमाएँ','उपयोग से पहले वर्तमान आधिकारिक पाठ जाँचें।','योजना इनपुट, निश्चित वैधानिक मान नहीं','तैयार किया गया'],
  bn:['প্রদর্শন একক','সরকারি উৎস','প্রোফাইল নির্দেশনা','এখতিয়ারের মানদণ্ড ও সীমা','ব্যবহারের আগে বর্তমান সরকারি পাঠ যাচাই করুন।','পরিকল্পনার ইনপুট, নির্দিষ্ট আইনি মান নয়','তৈরির তারিখ'],
  fil:['Yunit ng display','Opisyal na sanggunian','Gabay sa profile','Pamantayan at limitasyon ng hurisdiksiyon','Suriin ang kasalukuyang opisyal na teksto bago gamitin.','Input sa pagpaplano, hindi nakapirming halagang legal','Ginawa'],
  my:['ပြသယူနစ်','တရားဝင်ရင်းမြစ်','ပရိုဖိုင်လမ်းညွှန်','သက်ဆိုင်ရာ စံနှုန်းနှင့် ကန့်သတ်ချက်','အသုံးမပြုမီ လက်ရှိတရားဝင်စာသားကို စစ်ဆေးပါ။','စီမံကိန်းထည့်သွင်းချက်၊ ဥပဒေသတ်မှတ်တန်ဖိုးမဟုတ်','ဖန်တီးသည့်ရက်'],
  km:['ឯកតាបង្ហាញ','ប្រភពផ្លូវការ','ការណែនាំទម្រង់','លក្ខណៈវិនិច្ឆ័យ និងកម្រិតតាមយុត្តាធិការ','ពិនិត្យអត្ថបទផ្លូវការបច្ចុប្បន្នមុនប្រើ។','ទិន្នន័យសម្រាប់ផែនការ មិនមែនតម្លៃថេរតាមច្បាប់','បានបង្កើត'],
  mn:['Харуулах нэгж','Албан эх сурвалж','Профайлын заавар','Харьяаллын шалгуур ба хязгаар','Ашиглахаас өмнө одоогийн албан эхийг шалгана уу.','Төлөвлөлтийн утга, хуулийн тогтмол утга биш','Үүсгэсэн'],
  es:['Unidades de visualización','Fuente oficial','Guía del perfil','Criterios y límites de la jurisdicción','Verifique el texto oficial vigente antes de usar.','Entrada de planificación, no valor legal fijo','Generado'],
  pt:['Unidades de exibição','Fonte oficial','Orientação do perfil','Critérios e limites da jurisdição','Verifique o texto oficial vigente antes de usar.','Entrada de planejamento, não valor legal fixo','Gerado'],
  ar:['وحدات العرض','المصدر الرسمي','إرشادات الملف','معايير وحدود الولاية','تحقق من النص الرسمي الحالي قبل الاستخدام.','قيمة تخطيط وليست قيمة قانونية ثابتة','تاريخ الإنشاء'],
  fa:['واحدهای نمایش','منبع رسمی','راهنمای نمایه','معیارها و حدود حوزه قضایی','پیش از استفاده متن رسمی جاری را بررسی کنید.','ورودی برنامه‌ریزی، نه مقدار ثابت قانونی','تاریخ ایجاد'],
  ur:['نمائشی اکائیاں','سرکاری ماخذ','پروفائل رہنمائی','دائرۂ اختیار کے معیار اور حدود','استعمال سے پہلے موجودہ سرکاری متن کی تصدیق کریں۔','منصوبہ بندی کی قدر، مقررہ قانونی قدر نہیں','تیار کردہ'],
  ru:['Единицы отображения','Официальный источник','Указания профиля','Критерии и пределы юрисдикции','Перед использованием проверьте действующий официальный текст.','Плановое значение, не фиксированная норма закона','Создано'],
  uk:['Одиниці відображення','Офіційне джерело','Вказівки профілю','Критерії та межі юрисдикції','Перед використанням перевірте чинний офіційний текст.','Планове значення, не фіксована норма закону','Створено'],
  pl:['Jednostki wyświetlania','Źródło oficjalne','Wskazówki profilu','Kryteria i limity jurysdykcji','Przed użyciem sprawdź aktualny tekst urzędowy.','Wartość planistyczna, nie stała wartość ustawowa','Wygenerowano'],
  tr:['Görüntüleme birimleri','Resmî kaynak','Profil rehberi','Yargı alanı ölçütleri ve sınırları','Kullanmadan önce güncel resmî metni doğrulayın.','Planlama girdisi; sabit yasal değer değildir','Oluşturuldu'],
  de:['Anzeigeeinheiten','Offizielle Quelle','Profilhinweis','Kriterien und Grenzwerte der Rechtsordnung','Vor Verwendung den aktuellen amtlichen Text prüfen.','Planungswert, kein fester gesetzlicher Wert','Erstellt'],
  fr:['Unités affichées','Source officielle','Guide du profil','Critères et limites de la juridiction','Vérifiez le texte officiel en vigueur avant utilisation.','Valeur de planification, non valeur légale fixe','Généré'],
  it:['Unità visualizzate','Fonte ufficiale','Guida del profilo','Criteri e limiti della giurisdizione','Verificare il testo ufficiale vigente prima dell’uso.','Valore di pianificazione, non valore legale fisso','Generato'],
  cs:['Zobrazené jednotky','Oficiální zdroj','Pokyny profilu','Kritéria a limity jurisdikce','Před použitím ověřte aktuální oficiální text.','Plánovací hodnota, nikoli pevná zákonná hodnota','Vytvořeno'],
  ro:['Unități afișate','Sursă oficială','Îndrumarea profilului','Criterii și limite jurisdicționale','Verificați textul oficial în vigoare înainte de utilizare.','Valoare de planificare, nu valoare legală fixă','Generat'],
  hu:['Megjelenítési egységek','Hivatalos forrás','Profilútmutató','Joghatósági kritériumok és határértékek','Használat előtt ellenőrizze a hatályos hivatalos szöveget.','Tervezési érték, nem rögzített jogszabályi érték','Készült'],
  kk:['Көрсету бірліктері','Ресми дереккөз','Профиль нұсқаулығы','Юрисдикция өлшемдері мен шектері','Қолданар алдында қолданыстағы ресми мәтінді тексеріңіз.','Жоспарлау мәні, заңдағы тұрақты мән емес','Жасалған'],
  uz:['Ko‘rsatish birliklari','Rasmiy manba','Profil ko‘rsatmasi','Yurisdiksiya mezonlari va chegaralari','Ishlatishdan oldin amaldagi rasmiy matnni tekshiring.','Rejalashtirish qiymati, qat’iy qonuniy qiymat emas','Yaratilgan']
};

let v04Jurisdiction = 'kr';
let v04Paper = 'A4';
let v04UnitSystem = 'si';
let v04UnitTouched = false;
let v04ProfileApplied = '';
let v04StepScrollReady = false;
let v04InitialStepScroll = true;
let v04KoreanReferencePanelHTML = '';
let v04SupplementalPrintLanguages = new Set();

/* Corrections for translation defects found during the full-language audit. */
Object.assign(UI_FULL_I18N.zh,{
  choiceB_title:'已知污染物产生率',resultA:'换气量计算结果',
  aMultiplierHint:'KOSHA GUIDE H-80-2021 建议初始吹扫至少达到 10 倍空间体积。'
});
Object.assign(UI_FULL_I18N.zht,{
  choiceB_title:'已知污染物產生率',resultA:'換氣量計算結果',
  aMultiplierHint:'KOSHA GUIDE H-80-2021 建議初始吹掃至少達到 10 倍空間體積。'
});
Object.assign(UI_FULL_I18N.uz,{optionalDuct:'Ixtiyoriy kanal va statik bosim sharoitlari'});

Object.entries(V04_FAN_METHODS).forEach(([code,methods])=>{
  if(PRINT_I18N[code]) PRINT_I18N[code].methods=methods;
});

Object.keys(PRINT_I18N).forEach(code=>{
  if(PRINT_CRITERIA_I18N[code])return;
  const term=(V04_TERMS[code]||V04_TERMS.en)[5];
  PRINT_CRITERIA_I18N[code]={
    label:term,
    volume:(m,a)=>`${m}× · ${a} ACH`,
    dilution:k=>`K=${k}`
  };
});

const V04_LEGAL_DATA=Object.fromEntries(Object.entries(V05_REGULATORY_DATA.profiles).map(([code,profile])=>[code,{rows:profile.rows||[],clauses:profile.clauses||''}]));

function escapeV04(value){
  return String(value ?? '').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function cleanV04Text(value,max=200){
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max);
}
function safeV04StorageGet(key){
  try{return window.localStorage?localStorage.getItem(key):null;}catch(_){return null;}
}
function safeV04StorageSet(key,value){
  try{if(window.localStorage)localStorage.setItem(key,value);return true;}catch(_){return false;}
}
function finiteV04(value,fallback=0,min=0,max=1e12){
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
}
function uiV04(){
  return V04_UI[currentUiLanguage] || V04_UI.en;
}
function localeV04(){
  return ({zht:'zh-Hant',zh:'zh-Hans',fil:'fil-PH'}[currentUiLanguage] || currentUiLanguage || 'en');
}
function localeV04For(code){
  return ({zht:'zh-Hant',zh:'zh-Hans',fil:'fil-PH',my:'my-MM',km:'km-KH'}[code] || code || 'en');
}
function formatV04NumberFor(value,decimals=2,code=currentUiLanguage){
  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  try{return new Intl.NumberFormat(localeV04For(code),{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n);}
  catch(_){return n.toFixed(decimals);}
}
function formatV04DateFor(code,date=new Date()){
  try{return new Intl.DateTimeFormat(localeV04For(code),{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
  catch(_){return date.toISOString().slice(0,10);}
}
function v04Terms(code=currentUiLanguage){return V04_TERMS[code]||V04_TERMS.en;}
function v04VolumeText(value,decimals=2,code=currentUiLanguage){
  const n=Number(value)||0;
  if(v04UnitSystem==='us')return `${formatV04NumberFor(n*35.3146667,decimals,code)} ft³ (${formatV04NumberFor(n,decimals,code)} m³)`;
  return `${formatV04NumberFor(n,decimals,code)} m³`;
}
function v04FlowText(value,decimals=2,code=currentUiLanguage){
  const n=Number(value)||0;
  if(v04UnitSystem==='us')return `${formatV04NumberFor(n/1.69901082,decimals,code)} CFM (${formatV04NumberFor(n,decimals,code)} m³/h)`;
  return `${formatV04NumberFor(n,decimals,code)} m³/h`;
}
function v04LanguageMeta(code){
  return UI_LANGUAGE_META.find(item=>item[0]===code) || [code,code,code];
}
function setV04SupplementalPrintLanguage(code,checked){
  if(code===currentUiLanguage)return;
  if(checked)v04SupplementalPrintLanguages.add(code);
  else v04SupplementalPrintLanguages.delete(code);
  renderTranslatedReports();
}
function renderV04PrintLanguageGrid(){
  const grid=document.getElementById('print-language-grid');
  if(grid){
    grid.innerHTML=UI_LANGUAGE_META.filter(item=>item[0]!==currentUiLanguage).map(([code,,native])=>
      `<label><input type="checkbox" name="print-lang" value="${code}" ${v04SupplementalPrintLanguages.has(code)?'checked':''} onchange="setV04SupplementalPrintLanguage('${code}',this.checked)"><span class="lang-native">${native}</span></label>`
    ).join('');
  }
  const meta=v04LanguageMeta(currentUiLanguage);
  const hint=document.querySelector('.language-options > .hint');
  if(hint)hint.textContent=`① ${meta[2]} = Primary · ☑ +1 page / Additional document`;
  const card=document.getElementById('report-card');
  if(card)card.dataset.primaryLang=currentUiLanguage;
}
getSelectedPrintLanguages=function(){
  const result=[];
  if(currentUiLanguage!=='ko')result.push(currentUiLanguage);
  v04SupplementalPrintLanguages.forEach(code=>{
    if(code!==currentUiLanguage&&code!=='ko'&&UI_LANGUAGE_META.some(item=>item[0]===code))result.push(code);
  });
  return result;
};
function formatV04Number(value,decimals=2){
  const n=Number(value);
  if(!Number.isFinite(n)) return '—';
  try{return new Intl.NumberFormat(localeV04(),{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n);}
  catch(_){return n.toFixed(decimals);}
}
function formatV04Date(date=new Date()){
  try{return new Intl.DateTimeFormat(localeV04(),{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
  catch(_){return date.toISOString().slice(0,10);}
}
function setPrintPaper(value){
  v04Paper=value==='Letter'?'Letter':'A4';
  const select=document.getElementById('paper-size');
  if(select)select.value=v04Paper;
  let style=document.getElementById('v04-paper-rule');
  if(!style){style=document.createElement('style');style.id='v04-paper-rule';document.head.appendChild(style);}
  const pageSize=v04Paper==='Letter'?'8.5in 11in':'210mm 297mm';
  const pageWidth=v04Paper==='Letter'?'215.9mm':'210mm';
  style.textContent=`@page{size:${pageSize};margin:${v04Paper==='Letter'?'8mm':'7mm'};}
    @media print{html,body{min-width:0!important}.report{width:auto!important;max-width:calc(${pageWidth} - 16mm)!important;margin:0 auto!important;}}`;
  document.documentElement.dataset.printPaper=v04Paper;
  const note=document.getElementById('paper-support-note');
  if(note){
    note.textContent=v04Paper==='Letter'
      ? (currentUiLanguage==='ko'
          ? 'Letter 레이아웃을 적용합니다. 휴대폰 인쇄창이 A4를 유지하면 인쇄 서비스의 용지 항목에서 US Letter를 직접 선택하십시오.'
          : 'Letter layout is applied. If the mobile print dialog still shows A4, select US Letter in the print service.')
      : '';
  }
}
function setV04UnitSystem(value,automatic=false){
  v04UnitSystem=value==='us'?'us':'si';
  if(!automatic)v04UnitTouched=true;
  const select=document.getElementById('unit-system');if(select)select.value=v04UnitSystem;
  const note=document.getElementById('unit-support-note');
  if(note){
    note.textContent=v04UnitSystem==='us'
      ? (currentUiLanguage==='ko'
          ? '결과는 ft³·CFM을 먼저 표시하고 SI를 병기합니다. 치수·장비 입력과 저장 데이터는 SI이며, CFM 장비값은 5단계 변환기를 사용하십시오.'
          : 'Results show ft³/CFM first with SI in parentheses. Dimension/equipment inputs and saved data remain SI; use the Step 5 converter for CFM equipment data.')
      : '';
  }
  if(state.result && state.mode)computeAndRenderStep4();
  renderFanTable();
  if(state.step===6){renderReport();renderTranslatedReports();}
}
function buildV04TranslatedLegalHTML(code){
  const d=V04_LEGAL_DATA[v04Jurisdiction]||V04_LEGAL_DATA.kr;
  const t=v04Terms(code);
  const p=V04_PROFILES[v04Jurisdiction]||V04_PROFILES.kr;
  const sourceLanguage=v05LegalSourceLanguage(v04Jurisdiction);
  const rows=d.rows.map(([label,value])=>`<tr><td>${escapeV04(label)}</td><td>${escapeV04(value)}</td></tr>`).join('');
  const links=[[p.source,p.url],...(p.extraSources||[])].filter(x=>x[1]).map(([label,url])=>
    `<a href="${escapeV04(url)}" target="_blank" rel="noopener noreferrer">${escapeV04(label)}</a>`).join(' · ');
  return `<h3 class="translated-legal-heading"><span>6</span>${escapeV04(t[3])}</h3>
    <table class="translated-legal-table" lang="${escapeV04(localeV04For(sourceLanguage))}"><tbody>${rows}<tr><td>${escapeV04(t[1])}</td><td>${escapeV04(d.clauses)}</td></tr></tbody></table>
    <div class="translated-legal-source"><b>${escapeV04(v05LegalSourceLabel(code))}</b><br>${links}<br>${escapeV04(t[4])}</div>`;
}
function applyV04PlanningHints(){
  const mult=document.getElementById('a-multiplier')?.closest('.field');
  const ach=document.getElementById('a-ach')?.closest('.field');
  if(v04Jurisdiction==='kr'){
    const full=getFullUiText();
    const opts=[mult,ach].map(field=>field?.querySelector('label .opt'));
    if(opts[0])opts[0].textContent=currentUiLanguage==='ko'?'최소 기준':full.aMultiplierOpt;
    if(opts[1])opts[1].textContent=currentUiLanguage==='ko'?'최소 기준':full.aAchOpt;
    const multHint=mult?.querySelector(':scope > .hint');
    const achHint=ach?.querySelector(':scope > .hint');
    if(multHint)multHint.innerHTML=currentUiLanguage==='ko'
      ? '기본값 <b>10배 이상</b> — KOSHA GUIDE H-80-2021 9.1(1)의 권장 최소치입니다. 법 조문은 작업 전·중 적정공기를 유지하도록 환기할 의무를 규정하며, 구체적 배수는 기술지침에서 제시합니다.'
      : escapeV04(full.aMultiplierHint);
    if(achHint)achHint.innerHTML=currentUiLanguage==='ko'
      ? '기본값 <b>20회/h 이상</b> — KOSHA GUIDE H-80-2021 9.1(1)의 권장 최소치입니다. 팬을 끄지 않고 연속 가동할 때의 목표 환기횟수입니다.'
      : escapeV04(full.aAchHint);
    return;
  }
  const term=v04Terms()[5];
  [mult,ach].forEach(field=>{const opt=field?.querySelector('label .opt');if(opt)opt.textContent=term;});
  const multHint=mult?.querySelector(':scope > .hint');
  const achHint=ach?.querySelector(':scope > .hint');
  const english=currentUiLanguage!=='ko';
  if(multHint)multHint.textContent=english
    ? 'Enter the site-approved initial purge multiplier. This profile does not treat 10× as a universal statutory value.'
    : '사업장 위험성평가·공학기준으로 승인한 최초 퍼지 배수를 입력하십시오. 이 프로필에서 10배는 보편적인 법정 고정값이 아닙니다.';
  if(achHint)achHint.textContent=english
    ? 'Enter the site-approved continuous air-change rate. Verify safe conditions by atmospheric testing and monitoring.'
    : '사업장 위험성평가·공학기준으로 승인한 연속 환기횟수를 입력하십시오. 안전조건은 대기 시험·감시로 확인해야 합니다.';
}
function scrollV04StepIntoView(n){
  if(!v04StepScrollReady)return;
  if(v04InitialStepScroll){
    v04InitialStepScroll=false;
    window.scrollTo({top:0,behavior:'auto'});
    return;
  }
  requestAnimationFrame(()=>{
    const target=document.querySelector(`.step[data-step="${n}"] .card`) ||
      document.querySelector(`.step[data-step="${n}"]`);
    if(!target)return;
    const top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-10);
    window.scrollTo({top,behavior:'smooth'});
    const heading=target.querySelector('h2');
    if(heading){
      heading.setAttribute('tabindex','-1');
      setTimeout(()=>heading.focus({preventScroll:true}),260);
    }
  });
}
function setJurisdictionProfile(value){
  const next=V04_PROFILES[value]?value:'kr';
  const changed=next!==v04ProfileApplied;
  v04Jurisdiction=next;
  const p=V04_PROFILES[v04Jurisdiction];
  applyOperationalUiText();
  if(changed){
    v04ProfileApplied=v04Jurisdiction;
    setPrintPaper(v04Jurisdiction.startsWith('us-')?'Letter':'A4');
    if(!v04UnitTouched)setV04UnitSystem(v04Jurisdiction.startsWith('us-')?'us':'si',true);
  }
  const terms=v04Terms();
  const note=document.getElementById('profile-note');
  if(note) note.textContent=`${v05ProfileDisplayName(v04Jurisdiction) } — ${terms[4]}`;
  const src=document.getElementById('profile-source');
  if(src){
    const links=[[p.source,p.url],...(p.extraSources||[])].filter(x=>x[1]).map(([label,url])=>
      `<a href="${escapeV04(url)}" target="_blank" rel="noopener noreferrer">${escapeV04(label)}</a>`).join(' · ');
    src.innerHTML=`<b>${escapeV04(terms[1])}:</b> ${links} <span>· ${escapeV04(p.reviewedAt||'—')} · ${escapeV04(terms[4])}</span>`;
  }
  applyV04PlanningHints();
  if(typeof v05RefreshProfileOptions==='function')v05RefreshProfileOptions();
  updateV04ScreenReferencePanel();
  updateV04PrintMeta();
  if(state.step===6&&state.result)renderReport();
}
function formatV04Criterion(value){
  return v04Jurisdiction==='kr'
    ? value
    : `${v04Terms()[5]} · ${value}`;
}
function v04ChecklistCard(number,title,subtitle,items){
  return `<div class="permit-check">
    <div class="permit-check-head"><span class="check-num">${number}</span><span class="permit-check-title"><b>${title}</b><small>${subtitle}</small></span></div>
    ${items.map(item=>`<div class="permit-subcheck"><b>□ ${item[0]}</b><span>${item[1]}</span></div>`).join('')}
  </div>`;
}
function buildV04PermitChecklistHTML(){
  if(v04Jurisdiction==='kr')return buildPermitChecklistHTML();
  let cards=[];
  if(v04Jurisdiction==='us-general'){
    cards=[
      ['분류·프로그램','29 CFR 1910.146(c) 사전 평가와 서면 프로그램',[
        ['Permit-space 평가','공간의 대기·매몰·형상·기타 중대위험을 평가하고 허가필요 공간 여부를 결정'],
        ['서면 프로그램','무단진입 방지, 허용 진입조건, 작업절차와 위험통제 방법을 문서화']]],
      ['격리·시험·감시','29 CFR 1910.146(d)(3)~(5)',[
        ['격리·위험통제','에너지·배관을 격리하고 필요에 따라 purge·flush·ventilate하여 대기위험 통제'],
        ['대기 시험','산소 19.5~23.5%, 가연성 10% LFL 초과 금지, 독성물질별 OSHA PEL 이하를 확인하고 산소 → 가연성 → 독성 순서로 감시']]],
      ['허가·역할','29 CFR 1910.146(e)~(j)',[
        ['Entry permit','진입감독자가 시험·절차·장비를 확인하고 허가서에 서명한 후 출입구에 제공'],
        ['인원·연락','Entrant·attendant·entry supervisor를 지정하고 출입 인원과 통신을 계속 유지']]],
      ['구조·종료','29 CFR 1910.146(k)',[
        ['구조 준비','해당 공간·위험에 적합하고 적시에 대응 가능한 구조서비스와 호출수단 확인'],
        ['즉시 대피','금지조건·경보·감시 실패 시 대피하고 허가를 종료·취소한 뒤 재평가']]]
    ];
  }else if(v04Jurisdiction==='us-construction'){
    cards=[
      ['현장평가·조정','29 CFR 1926.1203~1204',[
        ['Permit-space 평가','Entry employer가 허가공간 위험을 식별·평가하고 무단진입을 방지'],
        ['도급사 조정','Controlling contractor와 다수 고용주의 동시 작업·상호 유발위험을 조정']]],
      ['격리·연속감시','29 CFR 1926.1204(c)~(e)',[
        ['격리·환기','공간과 물리적 위험을 격리하고 purge·inert·flush·ventilate하여 대기위험 통제'],
        ['시험·감시','산소 19.5~23.5%, 가연성 10% LFL 초과 금지, 적용 OSHA PEL 이하를 확인하고 원칙적으로 연속 감시']]],
      ['허가·감시인','29 CFR 1926.1205~1210',[
        ['Entry permit','Entry supervisor가 허가서에 서명하고 entrant가 확인할 수 있도록 출입구에 제공'],
        ['Attendant','외부 감시인을 두고 인원·통신·대피명령·비상호출 책임을 유지']]],
      ['구조·재검토','29 CFR 1926.1211',[
        ['비진입 구조','위험을 증가시키지 않는 한 retrieval system을 이용한 비진입 구조를 우선'],
        ['중지·재평가','허가되지 않은 조건 발생 시 작업을 중지하고 허가를 정지·취소한 뒤 공간 재평가']]]
    ];
  }else if(v04Jurisdiction==='uk'){
    cards=[
      ['진입 회피·위험평가','Confined Spaces Regulations 1997, Reg. 4',[ 
        ['진입 회피','합리적으로 가능한 경우 외부 작업 등으로 밀폐공간 진입 자체를 피함'],
        ['위험성평가','공간·공정·잔류물·유입·작업발생 위험과 필요한 통제조치를 평가']]],
      ['안전작업체계','Reg. 4 / HSE ACOP L101',[
        ['격리·환기·측정','기계·전기·배관을 격리하고 환기한 뒤 정상 공기 약 20.8%와의 편차, DSEAR 가연성 위험, COSHH WEL을 시험·평가'],
        ['작업자·감독','적합한 교육·경험·체력을 갖춘 인원, 감독·통신·출입통제를 확보']]],
      ['장비·작업조건','HSE ACOP L101',[
        ['장비 적합성','가스측정기, 호흡보호구, 조명·전기·방폭·출입장비의 점검 상태 확인'],
        ['조건 유지','작업 중 대기와 환기 상태를 확인하고 조건 변화 시 즉시 중지·대피']]],
      ['비상조치','Confined Spaces Regulations 1997, Reg. 5',[
        ['사전 준비','작업 시작 전에 구조인원·장비·연락·응급처치가 포함된 비상조치 마련'],
        ['무계획 구조 금지','구조자가 같은 위험에 노출되지 않도록 훈련·호흡보호·회수수단 준비']]]
    ];
  }else if(v04Jurisdiction==='au'){
    cards=[
      ['위험성평가','WHS Regulations 2011, Reg. 66',[ 
        ['공간·작업 위험','공간의 성격, 산소·오염물질, 작업방법, 출입구와 구조 가능성을 평가'],
        ['검토·기록','작업·조건 변경 시 평가를 재검토하고 해당 주·준주 요구사항 확인']]],
      ['진입허가·통제','WHS Regulations, Reg. 67~69',[
        ['Entry permit','공간·작업·인원·통제·유효기간을 포함한 진입허가서를 발행'],
        ['격리·표지','유입·에너지·설비를 격리하고 무단진입 방지 표지와 출입통제 유지']]],
      ['대기·환기','WHS Regulations, Reg. 70~72',[
        ['시험·감시','산소 19.5~23.5%, 독성물질별 노출기준 이하를 외부 상·중·하부에서 시험하고 위험에 따라 연속감시'],
        ['환기·가연성','5% LEL 미만 유지. 5~10%는 연속검지기 없으면 철수, 10% 이상 즉시 철수. 산소 21% 초과 가스로 환기 금지']]],
      ['감시·구조','Model Code of Practice',[
        ['Stand-by person','공간 밖 감시인과 지속적인 통신·인원 확인·비상호출 유지'],
        ['구조계획','공간 형상과 위험에 맞는 구조·응급절차와 장비를 진입 전에 시험·준비']]]
    ];
  }else{
    cards=[
      ['공간 등록·출입통제','WSH (Confined Spaces) Regulations, Reg. 4~9',[
        ['공간·출입구','밀폐공간 기록, 안전한 출입구·조명·환기와 경고표지 확인'],
        ['Permit system','책임자와 authorised manager가 운영하는 진입허가 체계 시행']]],
      ['평가·허가','Reg. 10~14',[
        ['Safety assessor','안전평가자가 위험통제와 대기상태를 평가하고 검사결과를 허가서에 기록'],
        ['Authorised manager','통제조치가 효과적이고 작업이 안전하다고 판단한 뒤 허가서 발행·게시']]],
      ['대기·작업 중 감시','Reg. 15~18 / WSHC Technical Advisory',[
        ['가스검사','산소 19.5~23.5%, 가연성 10% LEL 미만, 독성물질 노출기준 확인'],
        ['계속 관리','작업자를 감시하고 주기적으로 대기를 재시험하며 부적정·양립불가 작업 시 중지']]],
      ['훈련·감시인·구조','Reg. 19~23',[
        ['Attendant','훈련된 confined-space attendant가 외부에서 인원·상태·연락을 지속 확인'],
        ['구조 준비','적합한 PPE·호흡보호구·회수장비와 구조절차를 진입 전에 준비']]]
    ];
  }
  return `<div class="permit-checklist">${cards.map((c,i)=>v04ChecklistCard(i+1,c[0],c[1],c[2])).join('')}</div>`;
}
function buildV04SafetyNotice(){
  if(v04Jurisdiction==='kr'){
    return `<div class="note danger"><b>출입허가 판단 주의:</b> 본 결과는 환기계획을 위한 참고값이며 출입허가서나 농도 측정기록을 대체하지 않습니다. 작업 시작·재개 전에는 제619조의2에 따른 측정·평가를 실시하고, 제620조에 따라 작업 전·중 적정공기가 유지되도록 환기해야 합니다. 부적정·경보·이상징후가 있으면 즉시 작업을 중지하고 대피하십시오.</div>`;
  }
  const text={
    'us-general':'본 계산서는 29 CFR 1910.146의 entry permit, pre-entry testing, continuous/periodic monitoring 또는 entry supervisor의 승인을 대체하지 않습니다. 허용되지 않은 조건이 발생하면 즉시 대피하고 허가를 종료·취소하십시오.',
    'us-construction':'본 계산서는 29 CFR 1926 Subpart AA의 permit-space program, entry permit, atmospheric monitoring 및 controlling contractor 조정을 대체하지 않습니다. 허가되지 않은 조건이 발생하면 즉시 대피하고 재평가하십시오.',
    uk:'본 계산서는 영국 Confined Spaces Regulations 1997의 진입 회피 원칙, 위험성평가에 따른 안전작업체계와 작업 전 비상조치를 대체하지 않습니다. 안전조건을 유지할 수 없으면 진입하지 마십시오.',
    au:'본 계산서는 호주 WHS 위험성평가·진입허가·대기시험·감시·비상절차를 대체하지 않습니다. 적용 주·준주의 현행 법령과 Model Code의 법적 효력을 확인하십시오.',
    sg:'본 계산서는 싱가포르 WSH 진입허가, 안전평가자의 가스검사, authorised manager의 승인, 작업 중 감시·주기시험과 구조절차를 대체하지 않습니다.'
  }[v04Jurisdiction];
  return `<div class="note danger"><b>Selected profile / 출입 판단 주의:</b> ${text}</div>`;
}
function v04ReferenceTable(rows,footnote){
  return `<table class="responsive-table report-source-table"><colgroup><col style="width:22%;"><col style="width:78%;"></colgroup>
    <tbody>${rows.map(row=>`<tr><td><b>${row[0]}</b></td><td>${row[1]}</td></tr>`).join('')}</tbody></table>
    <p class="hint">${footnote}</p>`;
}
function v04CompanyReferenceRows(){
  const value=cleanV04Text(document.getElementById('profile-reference')?.value,160);
  return value?[['추가 회사 기준',escapeV04(value)]]:[];
}
function buildV04ReferenceHTML(mode){
  if(v04Jurisdiction==='kr')return buildReferenceHTML(mode);
  if(v04Jurisdiction==='us-general')return v04ReferenceTable([
    ['대기 수치 기준','산소 19.5~23.5%. 가연성 가스·증기가 10% LFL를 초과하거나 독성물질이 OSHA PEL을 초과하면 hazardous atmosphere'],
    ['독성·기타 위험','물질별 OSHA PEL 이하를 확인하고, PEL이 없는 물질은 SDS·공인 자료·사업장 기준으로 허용조건을 설정. 기타 IDLH 상태도 진입 불가'],
    ['1910.146(c)','공간 평가·표지·무단진입 방지 및 적용 시 서면 permit-space program'],
    ['1910.146(d)(3)~(5)','격리·purge·flush·ventilate, 진입 전 시험과 작업 중 허용조건 감시; 산소→가연성→독성 순서'],
    ['1910.146(e)~(f)','Entry supervisor 서명, 허가서 게시·제공, 시험결과·인원·위험·구조·통신 기록'],
    ['1910.146(h)~(k)','Entrant·attendant·entry supervisor 임무와 구조·비상서비스'],
    ...v04CompanyReferenceRows()
  ],'OSHA 1910.146은 본 도구의 10배·20회/h를 법정 고정값으로 규정하지 않습니다. 입력한 환기값은 사업장 공학기준이며 허용 진입조건의 시험·감시가 우선합니다.');
  if(v04Jurisdiction==='us-construction')return v04ReferenceTable([
    ['대기 수치 기준','산소 19.5~23.5%. 가연성 가스·증기·미스트가 10% LFL를 초과하거나 독성물질이 적용 OSHA PEL을 초과하면 hazardous atmosphere'],
    ['시험·감시 순서','산소 → 가연성 가스·증기 → 잠재적 독성 오염물질 순으로 시험. 위험 변화 가능 시 원칙적으로 연속감시'],
    ['29 CFR 1926.1203','건설현장 confined space 식별·평가, 고용주 간 정보제공과 controlling contractor 조정'],
    ['1926.1204(c)~(e)','격리·환기·외부위험 방호, 산소→가연성→독성 시험 및 원칙적 연속감시'],
    ['1926.1205~1206','Entry permit 작성·서명·게시·정지·취소와 허가서 필수 내용'],
    ['1926.1207~1210','훈련, authorized entrant·attendant·entry supervisor 임무'],
    ['1926.1211','구조서비스 평가, 구조훈련, 원칙적 비진입 구조와 retrieval system'],
    ...v04CompanyReferenceRows()
  ],'OSHA 1926 Subpart AA는 고정 ACH보다 위험평가·허가·격리·감시·구조체계를 요구합니다. 계산 입력값은 현장 공학기준과 고용주 프로그램으로 승인해야 합니다.');
  if(v04Jurisdiction==='uk')return v04ReferenceTable([
    ['산소 기준','Confined Spaces Regulations와 HSE L101은 공통 법정 진입범위를 숫자로 고정하지 않음. 정상 공기 약 20.8%에서 유의하게 벗어나면 원인을 평가하고 안전성이 확인될 때까지 진입 금지'],
    ['가연성·독성 기준','가연성 위험은 DSEAR 위험성평가와 안전작업체계, 독성물질은 COSHH 및 해당 물질의 Workplace Exposure Limit(WEL)을 적용'],
    ['Confined Spaces Regulations 1997, Reg. 4','합리적으로 가능한 경우 진입을 피하고, 불가피하면 안전작업체계를 적용'],
    ['Reg. 5','밀폐공간 작업을 시작하기 전에 적합하고 충분한 비상조치를 마련'],
    ['HSE ACOP L101','위험성평가, 감독, 작업자 적합성, 격리, 환기, 대기시험, 통신, PPE와 구조 실무지침'],
    ['HSE INDG258','밀폐공간 위험과 안전작업체계·비상절차에 대한 근로자용 안내'],
    ...v04CompanyReferenceRows()
  ],'영국 기준에는 모든 밀폐공간에 공통 적용되는 단일 산소·LEL 허용표가 없습니다. 측정 대상별 WEL, DSEAR 및 위험성평가 결과로 허용조건을 정하고 기록하십시오.');
  if(v04Jurisdiction==='au')return v04ReferenceTable([
    ['산소 허용범위','19.5~23.5%를 안전한 산소농도로 봄. 19.5% 미만에서 작업이 불가피하면 공기공급식 호흡보호구 필요'],
    ['가연성 관리기준','원칙적으로 5% LEL 미만 유지. 5% 이상 10% 미만은 교정된 연속 가스검지기 없이 작업 금지·철수, 10% LEL 이상이면 즉시 철수'],
    ['독성물질 기준','해당 물질의 호주 workplace exposure standard 미만. 불확실하거나 건강위험 판단에 필요하면 공기 중 농도 감시'],
    ['퍼지·환기용 가스','순수 산소 또는 산소농도 21% 초과 혼합가스를 퍼지·환기에 사용 금지'],
    ['WHS Regulations 2011, Reg. 66','밀폐공간 작업 관련 위험의 식별·평가'],
    ['Reg. 67~69','진입허가, 표지, 무단진입 방지와 통신·감시'],
    ['Reg. 70~72','특정 위험통제, 대기 purge·환기, 가연성 대기 관리'],
    ['Safe Work Australia Model Code','대기시험, 위험성평가, 감시인, 격리, PPE와 구조 실무지침'],
    ...v04CompanyReferenceRows()
  ],'Model Code의 법적 효력과 채택 상태는 호주 주·준주마다 다를 수 있으므로 해당 규제기관의 현행 요구사항을 확인하십시오.');
  return v04ReferenceTable([
    ['산소 허용범위','19.5~23.5% by volume'],
    ['가연성 관리기준','가연성 가스·증기 10% LEL 미만'],
    ['독성물질 기준','WSH (General Provisions) Regulations First Schedule의 물질별 permissible exposure level 이하'],
    ['WSH Reg. 4~8','공간 기록, 출입구, 조명과 환기'],
    ['WSH Reg. 9~18','진입허가, safety assessor 평가, authorised manager 승인, 게시·감시·주기시험·재검토'],
    ['WSH Reg. 19~23','경고표지, 식별, 교육, confined-space attendant와 구조작업'],
    ['SS 568 / WSHC Technical Advisory','밀폐공간 작업의 실무 안전지침과 가스검사·환기·구조 참고'],
    ...v04CompanyReferenceRows()
  ],'싱가포르 법령의 현재 상태와 사업장별 추가 회사 기준을 함께 확인하십시오. 계산값은 진입허가와 가스검사를 대체하지 않습니다.');
}
function updateV04ScreenReferencePanel(){
  const panel=document.querySelector('details.ref-panel');
  if(!panel)return;
  if(v04Jurisdiction==='kr'){
    if(v04KoreanReferencePanelHTML&&panel.dataset.profile!=='kr'){
      panel.innerHTML=v04KoreanReferencePanelHTML;
      panel.dataset.profile='kr';
      initGuidanceAccordion();
    }
    return;
  }
  const p=V04_PROFILES[v04Jurisdiction];
  const title=`📋 ${v04Terms()[3]} — ${p.label}`;
  const translated=PRINT_I18N[currentUiLanguage]||PRINT_I18N.en;
  const screenChecks=currentUiLanguage==='ko'
    ? buildV04PermitChecklistHTML()
    : `<div class="translated-checks">${translated.checks.map(c=>`<div class="translated-check"><b>□ ${escapeV04(c[0])}</b>${escapeV04(c[1])}</div>`).join('')}</div>`;
  const references=currentUiLanguage==='ko'
    ? buildV04ReferenceHTML(state.mode)
    : buildV04TranslatedLegalHTML(currentUiLanguage);
  panel.dataset.profile=v04Jurisdiction;
  panel.innerHTML=`<summary>${title}</summary><div class="ref-panel-body">
    <div class="note"><b>${escapeV04(p.label)}</b><br>${escapeV04(v04Terms()[4])}</div>
    ${screenChecks}
    ${references}
  </div>`;
}
function applyV04Ui(){
  const t=uiV04();
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('profile-label',t[0]);set('profile-reference-label',t[1]);set('paper-label',t[2]);
  set('unit-label',v04Terms()[0]);
  document.documentElement.lang=localeV04();
  document.documentElement.dir=['ar','fa','ur'].includes(currentUiLanguage)?'rtl':'ltr';
  document.querySelectorAll('input[type="text"],textarea').forEach(el=>el.setAttribute('dir','auto'));
  setJurisdictionProfile(v04Jurisdiction);
  applyV04PlanningHints();
  setV04UnitSystem(v04UnitSystem,true);
}
function showV04Validation(items){
  const box=document.getElementById('validation-summary');
  if(!box)return;
  if(!items.length){box.classList.remove('show');box.textContent='';return;}
  const t=uiV04();
  box.textContent=`${t[3]} — ${t[4]}: ${items.join(', ')}`;
  box.classList.add('show');
  box.scrollIntoView({behavior:'smooth',block:'center'});
}
function validateV04Calculation(){
  const bad=[];
  const positive=(id,label)=>{const el=document.getElementById(id),n=Number(el?.value);if(!Number.isFinite(n)||n<=0)bad.push(label);};
  if(!state.mode) bad.push(getUiText()[5][0]);
  if(!Number.isFinite(state.volume)||state.volume<=0) bad.push((getFullUiText().volumeResult||'Space volume'));
  if(state.mode==='A'){positive('a-multiplier','Initial purge multiplier');positive('a-ach','Continuous ACH');}
  if(state.mode==='B'){positive('b-w','W');positive('b-m','M');positive('b-tlv','Exposure limit');positive('b-k','K');}
  if(state.mode==='C'){
    positive('c-q','Q');positive('c-t','t');positive('c-callow','Exposure limit');positive('c-k','K');
    ['c-c0','c-ct'].forEach(id=>{const n=Number(document.getElementById(id)?.value);if(!Number.isFinite(n)||n<0)bad.push(id==='c-c0'?'C0':'C(t)');});
  }
  showV04Validation(bad);
  return bad.length===0;
}
function sanitizeV04Session(data){
  if(!data||typeof data!=='object'||data.fileFormat!=='confined-space-session') return null;
  const version=Number(data.version||1);
  if(!Number.isInteger(version)||version<1||version>4) return null;
  if(data.zones!==undefined&&!Array.isArray(data.zones))return null;
  if(data.fans!==undefined&&!Array.isArray(data.fans))return null;
  if((data.zones||[]).length>100||(data.fans||[]).length>100)return null;
  const copy=JSON.parse(JSON.stringify(data));
  copy.mode=['A','B','C'].includes(copy.mode)?copy.mode:'A';
  copy.jurisdictionProfile=V04_PROFILES[copy.jurisdictionProfile]?copy.jurisdictionProfile:'kr';
  copy.paperSize=copy.paperSize==='Letter'?'Letter':'A4';
  copy.uiLanguage=UI_LANGUAGE_META.some(item=>item[0]===copy.uiLanguage)?copy.uiLanguage:'ko';
  copy.profileReference=cleanV04Text(copy.profileReference,160);
  copy.spaceName=cleanV04Text(copy.spaceName,160);
  copy.zones=(copy.zones||[]).map(z=>({
    name:cleanV04Text(z.name,160),
    shape:['direct','box','cyl','tri','frustum','trapezoid','poly'].includes(z.shape)?z.shape:'direct',
    sign:z.sign===-1?-1:1,
    vals:Object.fromEntries(Object.entries(z.vals||{}).slice(0,20).map(([k,v])=>[cleanV04Text(k,30),finiteV04(v)])),
    polyPoints:Array.isArray(z.polyPoints)?z.polyPoints.slice(0,100).map(p=>({
      x:finiteV04(p?.x,0,-1e7,1e7),y:finiteV04(p?.y,0,-1e7,1e7)
    })):[],
    polyH:finiteV04(z.polyH)
  }));
  copy.fans=(copy.fans||[]).map(f=>({
    name:cleanV04Text(f.name,160),rated:finiteV04(f.rated),eff:finiteV04(f.eff,75,0,100),
    flowMethod:['estimate','manufacturer','measured'].includes(f.flowMethod)?f.flowMethod:'estimate',
    appliedFlow:finiteV04(f.appliedFlow),ductDiameter:finiteV04(f.ductDiameter),
    ductLength:finiteV04(f.ductLength),bendCount:Math.floor(finiteV04(f.bendCount)),
    staticPressure:finiteV04(f.staticPressure),advancedNote:cleanV04Text(f.advancedNote,500),
    explosion:!!f.explosion,qty:Math.floor(finiteV04(f.qty))
  }));
  copy.printLanguages=Array.isArray(copy.printLanguages)?copy.printLanguages.filter(x=>UI_LANGUAGE_META.some(m=>m[0]===x)).slice(0,32):[];
  copy.unitSystem=copy.unitSystem==='us'?'us':'si';
  return copy;
}
function rewriteV04Units(container,code){
  if(!container)return;
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    let text=node.nodeValue;
    text=text.replace(/(-?\d+(?:\.\d+)?)\s*㎥\/h/g,(_,n)=>v04FlowText(Number(n),String(n).includes('.')?Math.min(2,String(n).split('.')[1].length):1,code));
    text=text.replace(/(-?\d+(?:\.\d+)?)\s*㎥/g,(_,n)=>v04VolumeText(Number(n),String(n).includes('.')?Math.min(2,String(n).split('.')[1].length):1,code));
    text=text.replace(/㎥\/h/g,'m³/h').replace(/㎥/g,'m³');
    node.nodeValue=text;
  });
}
function updateV04TranslatedValues(section,code){
  const r=state.result||{};
  const requiredQ=getRequiredQ();
  const totalSupply=state.fans.reduce((sum,f)=>sum+getFanEffective(f)*(parseFloat(f.qty)||0),0);
  const margin=requiredQ>0?((totalSupply/requiredQ-1)*100):null;
  const date=section.querySelector('.translated-overview-grid .date > div:nth-child(2)');
  if(date)date.textContent=formatV04DateFor(code);
  const marginNodes=section.querySelectorAll('.translated-overview-grid > .kv, .translated-key-metrics > div');
  marginNodes.forEach(node=>{
    const label=node.querySelector(':scope > div:first-child,:scope > span:first-child')?.textContent;
    if(label===PRINT_I18N[code]?.l?.margin){
      const value=node.querySelector(':scope > div:last-child,:scope > b:last-child');
      if(value)value.textContent=margin===null?'—':`${formatV04NumberFor(margin,1,code)}%`;
    }
  });
  section.querySelectorAll('.translated-equipment-table tbody tr').forEach((row,index)=>{
    const f=state.fans[index];if(!f)return;
    const cells=row.cells;
    if(cells[1])cells[1].textContent=formatV04NumberFor(f.rated||0,1,code);
    if(cells[4])cells[4].textContent=formatV04NumberFor(getFanEffective(f),1,code);
    if(cells[5])cells[5].textContent=formatV04NumberFor(f.qty||0,0,code);
  });
  rewriteV04Units(section,code);
}
function updateV04PrintMeta(){
  const p=V04_PROFILES[v04Jurisdiction]||V04_PROFILES.kr;
  const ref=cleanV04Text(document.getElementById('profile-reference')?.value,160);
  document.querySelectorAll('#report-body,.translated-report,.korean-supplement-report').forEach(container=>{
    const code=container.classList.contains('translated-report')?(container.dataset.language||currentUiLanguage):'ko';
    const terms=v04Terms(code);
    const ui=V04_UI[code]||V04_UI.en;
    const dateLabel=PRINT_I18N[code]?.l?.date||terms[6];
    const companyMeta=ref?`<div><span>${escapeV04(ui[1])}</span><br><b>${escapeV04(ref)}</b></div>`:'';
    const sourceLink=p.url
      ? `<a href="${escapeV04(p.url)}" target="_blank" rel="noopener noreferrer">${escapeV04(p.source)}</a>`
      : escapeV04(p.source);
    const markup=`<div class="global-print-meta"><div><span>${escapeV04(ui[0])}</span><br><b>${escapeV04(p.label)}</b></div>${companyMeta}<div><span>${escapeV04(terms[1])}</span><br><b>${sourceLink}</b></div><div><span>${escapeV04(dateLabel)} / ${escapeV04(ui[2])}</span><br><b>${escapeV04(formatV04DateFor(code))} · ${v04Paper} · ${v04UnitSystem==='us'?'US + SI':'SI'}</b></div><p class="global-profile-guidance"><b>${escapeV04(terms[2])}:</b> ${escapeV04(terms[4])}</p></div>`;
    container.querySelector(':scope > .global-print-meta')?.remove();
    container.insertAdjacentHTML('afterbegin',markup);
  });
}

const v04RenderStepper=renderStepper;
renderStepper=function(){
  v04RenderStepper();
  document.querySelectorAll('#stepper li').forEach((li,i)=>{
    li.setAttribute('role','button');li.setAttribute('tabindex','0');
    li.setAttribute('aria-current',i+1===state.step?'step':'false');
    li.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();li.click();}};
  });
};
const v04SelectMode=selectMode;
selectMode=function(m){
  v04SelectMode(m);
  document.querySelectorAll('.choice').forEach(c=>c.setAttribute('aria-checked',String(c.dataset.mode===m)));
};
const v04GoStep=goStep;
goStep=function(n){
  if(n>=4&&!validateV04Calculation())return;
  showV04Validation([]);
  v04GoStep(n);
};
const v04SetUiLanguage=setUiLanguage;
setUiLanguage=function(code){
  if(!UI_LANGUAGE_META.some(item=>item[0]===code))code='ko';
  v04SetUiLanguage(code);
  applyV04Ui();
  renderV04PrintLanguageGrid();
  if(state.step===6)renderTranslatedReports();
};
const v04MetricHTML=metricHTML;
metricHTML=function(label,value,unit,decimals){
  const d=decimals!==undefined?decimals:((Math.abs(value)>0&&Math.abs(value)<0.01)?5:2);
  if(/㎥\/h|m³\/h/.test(unit))return `<div class="metric"><div class="label">${label}</div><div class="value">${v04FlowText(value||0,d)} </div></div>`;
  if(/㎥|m³/.test(unit))return `<div class="metric"><div class="label">${label}</div><div class="value">${v04VolumeText(value||0,d)} </div></div>`;
  return `<div class="metric"><div class="label">${label}</div><div class="value">${formatV04Number(value||0,d)} <span class="unit">${unit}</span></div></div>`;
};
const v04UpdateZoneField=updateZoneField;
updateZoneField=function(id,key,val){
  if(key==='name')val=cleanV04Text(val,160);
  else if(key!=='shape'&&key!=='sign')val=finiteV04(val);
  v04UpdateZoneField(id,key,val);
};
const v04UpdateFan=updateFan;
updateFan=function(id,key,val){
  if(key==='name')val=cleanV04Text(val,160);
  if(key==='advancedNote')val=cleanV04Text(val,500);
  if(key==='flowMethod'&&!['estimate','manufacturer','measured'].includes(val))val='estimate';
  if(key==='eff')val=finiteV04(val,75,0,100);
  if(['rated','appliedFlow','ductDiameter','ductLength','staticPressure'].includes(key))val=finiteV04(val);
  if(key==='bendCount'||key==='qty')val=Math.floor(finiteV04(val));
  v04UpdateFan(id,key,val);
};
const v04SerializeSession=serializeSession;
serializeSession=function(){
  const data=v04SerializeSession();
  data.version=4;data.jurisdictionProfile=v04Jurisdiction;
  data.profileReference=cleanV04Text(document.getElementById('profile-reference')?.value,160);
  data.paperSize=v04Paper;data.uiLanguage=currentUiLanguage;data.unitSystem=v04UnitSystem;
  data.printLanguages=Array.from(v04SupplementalPrintLanguages)
    .filter(code=>code!==currentUiLanguage&&UI_LANGUAGE_META.some(item=>item[0]===code));
  return data;
};
const v04RestoreSession=restoreSession;
restoreSession=function(data){
  const safe=sanitizeV04Session(data);
  if(!safe){alert(uiMsg('올바르지 않거나 지원되지 않는 세션 파일입니다.','This session file is invalid or unsupported.'));return;}
  v04Jurisdiction=V04_PROFILES[safe.jurisdictionProfile]?safe.jurisdictionProfile:'kr';
  v04ProfileApplied=v04Jurisdiction;
  v04Paper=safe.paperSize==='Letter'?'Letter':'A4';
  v04UnitSystem=safe.unitSystem==='us'?'us':'si';v04UnitTouched=true;
  const restoredUiLanguage=UI_LANGUAGE_META.some(item=>item[0]===safe.uiLanguage)?safe.uiLanguage:currentUiLanguage;
  v04SupplementalPrintLanguages=new Set((safe.printLanguages||[])
    .filter(code=>code!==restoredUiLanguage&&UI_LANGUAGE_META.some(item=>item[0]===code)));
  v04RestoreSession(safe);
  const profile=document.getElementById('jurisdiction-profile');if(profile)profile.value=v04Jurisdiction;
  const reference=document.getElementById('profile-reference');if(reference)reference.value=cleanV04Text(safe.profileReference,160);
  const paper=document.getElementById('paper-size');if(paper)paper.value=v04Paper;
  setPrintPaper(v04Paper);setV04UnitSystem(v04UnitSystem,true);setUiLanguage(restoredUiLanguage);applyV04Ui();
};
importFans=function(e){
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>2*1024*1024){alert(uiMsg('JSON 파일이 너무 큽니다.','The JSON file is too large.'));e.target.value='';return;}
  const reader=new FileReader();
  reader.onload=evt=>{
    try{
      const arr=JSON.parse(evt.target.result);
      if(!Array.isArray(arr))throw new Error('array required');
      const safe=sanitizeV04Session({fileFormat:'confined-space-session',version:4,zones:[],fans:arr});
      if(!safe)throw new Error('invalid fan schema');
      state.fans=safe.fans.map(f=>({id:state.fanIdSeq++,...f,advancedOpen:false}));
      renderFanTable();
    }catch(_){alert(uiMsg('송배풍기 JSON 형식 또는 값이 올바르지 않습니다.','The blower JSON schema or values are invalid.'));}
  };
  reader.readAsText(file);e.target.value='';
};
loadSessionFromFile=function(e){
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>4*1024*1024){alert(uiMsg('세션 파일이 너무 큽니다.','The session file is too large.'));e.target.value='';return;}
  const reader=new FileReader();
  reader.onload=evt=>{
    try{restoreSession(JSON.parse(evt.target.result));}
    catch(_){alert(uiMsg('세션 파일을 읽을 수 없습니다. 파일이 손상되었거나 형식이 올바르지 않습니다.','The session file cannot be read. It may be damaged or use an invalid format.'));}
  };
  reader.readAsText(file);e.target.value='';
};
const v04RenderReport=renderReport;
renderReport=function(){
  v04RenderReport();
  rewriteV04Units(document.getElementById('report-body'),'ko');
  updateV04PrintMeta();
};
const v04RenderTranslatedReports=renderTranslatedReports;
renderTranslatedReports=function(){
  v04RenderTranslatedReports();
  const host=document.getElementById('translated-reports');
  if(!host)return;
  Array.from(host.children).forEach(section=>{
    if(!section.classList.contains('translated-report'))return;
    const code=section.dataset.language;
    section.classList.toggle('primary-translated-report',currentUiLanguage!=='ko'&&code===currentUiLanguage);
    const disclaimer=section.querySelector('.translated-disclaimer');
    if(disclaimer&&PRINT_I18N[code]?.safety)disclaimer.textContent=PRINT_I18N[code].safety;
    section.querySelector('.translated-legal-heading')?.remove();
    section.querySelector('.translated-legal-table')?.remove();
    section.querySelector('.translated-legal-source')?.remove();
    const footer=section.querySelector('.translated-document-footer');
    if(footer)footer.insertAdjacentHTML('beforebegin',buildV04TranslatedLegalHTML(code));
    updateV04TranslatedValues(section,code);
  });
  if(currentUiLanguage!=='ko'&&v04SupplementalPrintLanguages.has('ko')){
    const title=document.getElementById('print-title');
    const body=document.getElementById('report-body');
    if(title&&body){
      const section=document.createElement('section');
      /* Keep Korean as the native report layout.  Applying .translated-report
         here turns the Korean overview into translated mini-cards. */
      section.className='report korean-supplement-report';
      section.lang='ko';section.dataset.language='ko';
      section.innerHTML=`<div class="print-title korean-supplement-title">${title.innerHTML}</div>${body.innerHTML}`;
      rewriteV04Units(section,'ko');
      host.appendChild(section);
    }
  }
  updateV04PrintMeta();
};
printReport=function(){
  const selected=document.getElementById('paper-size')?.value||v04Paper;
  setPrintPaper(selected);
  renderTranslatedReports();
  updateV04PrintMeta();
  /* Two animation frames give mobile engines time to rebuild paged-media CSS. */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(window.AndroidBridge&&window.AndroidBridge.print){
      try{window.AndroidBridge.print(v04Paper);}
      catch(_){window.AndroidBridge.print();}
    }else{
      window.print();
    }
  }));
};

document.addEventListener('DOMContentLoaded',()=>{
  const refPanel=document.querySelector('details.ref-panel');
  if(refPanel){
    v04KoreanReferencePanelHTML=refPanel.innerHTML;
    refPanel.dataset.profile='kr';
  }
  document.querySelectorAll('.choice').forEach(card=>{
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};
  });
  document.getElementById('profile-reference')?.addEventListener('input',updateV04PrintMeta);
  /* The original initializer below creates the first editable space and blower. */
  v04StepScrollReady=true;
});


/* ============================================================
   초기화
============================================================ */
