function printReport(){
  renderTranslatedReports();
  if(window.AndroidBridge && window.AndroidBridge.print){
    window.AndroidBridge.print();
  } else {
    window.print();
  }
}
function downloadOrSave(filename, content, mime){
  if(window.AndroidBridge && window.AndroidBridge.saveFile){
    window.AndroidBridge.saveFile(filename, content);
    return;
  }


  function callPywebviewSave(){
    window.pywebview.api.save_file(filename, content).then(function(ok){
      if(ok === false){
        alert(uiMsg('저장이 취소되었거나 실패했습니다.','Save was cancelled or failed.') + ' (' + filename + ')');
      }
    }).catch(function(err){
      alert(uiMsg('파일 저장 중 오류가 발생했습니다: ','An error occurred while saving the file: ') + err);
    });
  }

  if(window.pywebview){
    // 데스크톱 앱(pywebview) 환경으로 추정됨.
    // 창이 뜬 직후에는 저장 기능(js_api)이 아직 연결되기 전일 수 있어, 준비될 때까지 잠시 재시도.
    if(window.pywebview.api && window.pywebview.api.save_file){
      callPywebviewSave();
      return;
    }
    let attempts = 0;
    const maxAttempts = 15; // 약 3초간 재시도
    const timer = setInterval(function(){
      attempts++;
      if(window.pywebview.api && window.pywebview.api.save_file){
        clearInterval(timer);
        callPywebviewSave();
      } else if(attempts >= maxAttempts){
        clearInterval(timer);
        alert(uiMsg(
          '데스크톱 앱의 저장 기능이 아직 준비되지 않았습니다.\n앱을 완전히 종료했다가 다시 실행한 뒤 시도해 주세요.',
          'The desktop save function is not ready yet.\nClose the app completely, restart it, and try again.'
        ));
      }
    }, 200);
    return;
  }

  const blob = new Blob([content], {type: mime || 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportFans(){
  const data = JSON.stringify(state.fans, null, 2);
  downloadOrSave('송배풍기_목록.json', data, 'application/json');
}
function importFans(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const arr = JSON.parse(evt.target.result);
      if(Array.isArray(arr)){
        state.fans = arr.map(f=>({
          id: state.fanIdSeq++,
          name: f.name||'', rated: f.rated||0, eff: f.eff!==undefined?f.eff:75,
          flowMethod: f.flowMethod||'estimate', appliedFlow:f.appliedFlow||0,
          ductDiameter:f.ductDiameter||0, ductLength:f.ductLength||0,
          bendCount:f.bendCount||0, staticPressure:f.staticPressure||0,
          advancedNote:f.advancedNote||'',
          advancedOpen:false,
          explosion: !!f.explosion, qty: f.qty||0
        }));
        renderFanTable();
      }
    }catch(err){ alert(uiMsg('JSON 파일을 읽을 수 없습니다.','The JSON file cannot be read.')); }
  };
  reader.readAsText(file);
}

/* ============================================================
   STEP 6 : 리포트
============================================================ */
