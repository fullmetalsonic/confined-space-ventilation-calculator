document.addEventListener('DOMContentLoaded', ()=>{
  initGuidanceAccordion();
  initializeLanguageControls();
  goStep(1);
  addZone('direct');
  /* Keep the starter equipment name empty. A prefilled Korean or translated
     name becomes stale as soon as the user changes the screen language. The
     localized placeholder still explains what belongs in the field. */
  addFanRow('', 500, 75, false);
});
