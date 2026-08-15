/* Localized presentation only: official rule titles and source names stay verbatim. */
const V05_PROFILE_COUNTRIES={kr:'KR','us-general':'US','us-construction':'US',uk:'GB',au:'AU',sg:'SG',jp:'JP',br:'BR'};
function v05ProfileLanguageName(code=currentUiLanguage){return v04LanguageMeta(code)[2]||code;}
function v05ProfileCountryName(profileCode,code=currentUiLanguage){
  if(profileCode==='unverified')return code==='ko'?'미검증 관할':'Unverified jurisdiction';
  const region=V05_PROFILE_COUNTRIES[profileCode];
  try{return new Intl.DisplayNames([localeV04For(code)],{type:'region'}).of(region)||region;}catch(_){return region||profileCode;}
}
function v05ProfileDisplayName(profileCode=v04Jurisdiction,code=currentUiLanguage){
  const profile=V04_PROFILES[profileCode]||V04_PROFILES.unverified;
  const official=String(profile.label||profileCode).split(' · ').slice(1).join(' · ')||profile.label||profileCode;
  return `${v05ProfileCountryName(profileCode,code)} · ${official}`;
}
function v05RefreshProfileOptions(){
  const select=document.getElementById('jurisdiction-profile');if(!select)return;
  [...select.options].forEach(option=>{option.textContent=v05ProfileDisplayName(option.value);});
  select.value=v04Jurisdiction;
}
