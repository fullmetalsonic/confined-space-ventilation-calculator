document.addEventListener('DOMContentLoaded', ()=>{
  initGuidanceAccordion();
  initializeLanguageControls();
  goStep(1);
  addZone('direct');
  addFanRow(currentUiLanguage==='ko'?'이동식 송풍기 #1':((PRINT_I18N[currentUiLanguage]||PRINT_I18N.en).l.equipment+' #1'), 500, 75, false);
});
