/* Localized presentation only: official rule titles and source names stay verbatim. */
const V05_PROFILE_COUNTRIES={kr:'KR','us-general':'US','us-construction':'US',uk:'GB',au:'AU',sg:'SG',jp:'JP',br:'BR'};
function v05ProfileLanguageName(code=currentUiLanguage){return v04LanguageMeta(code)[2]||code;}
function v05LocalizedLanguageName(code,displayCode=currentUiLanguage){
  const fallback=v05ProfileLanguageName(code);
  try{return new Intl.DisplayNames([localeV04For(displayCode)],{type:'language'}).of(localeV04For(code))||fallback;}catch(_){return fallback;}
}
function v05BilingualLanguageName(code,displayCode=currentUiLanguage){
  const localized=v05LocalizedLanguageName(code,displayCode);
  const native=v05ProfileLanguageName(code);
  try{if(localized.localeCompare(native,localeV04For(displayCode),{sensitivity:'base'})===0)return native;}catch(_){}
  return localized===native?native:`${localized} · ${native}`;
}
function v05ProfileCountryName(profileCode,code=currentUiLanguage){
  if(profileCode==='unverified')return `${(V04_UI[code]||V04_UI.en)[0]} · —`;
  const region=V05_PROFILE_COUNTRIES[profileCode];
  try{return new Intl.DisplayNames([localeV04For(code)],{type:'region'}).of(region)||region;}catch(_){return region||profileCode;}
}
function v05ProfileDisplayName(profileCode=v04Jurisdiction,code=currentUiLanguage){
  const profile=V04_PROFILES[profileCode]||V04_PROFILES.unverified;
  if(profileCode==='unverified')return v05ProfileCountryName(profileCode,code);
  const official=String(profile.label||profileCode).split(' · ').slice(1).join(' · ')||profile.label||profileCode;
  return `${v05ProfileCountryName(profileCode,code)} · ${official}`;
}
function v05RefreshProfileOptions(){
  const select=document.getElementById('jurisdiction-profile');if(!select)return;
  [...select.options].forEach(option=>{option.textContent=v05ProfileDisplayName(option.value);});
  select.value=v04Jurisdiction;
}
