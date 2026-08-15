/* Legal criteria remain attributable to their official source until a reviewed translation is supplied. */
const V05_LEGAL_SOURCE_LANGUAGE={kr:'ko',jp:'ja',br:'pt','us-general':'en','us-construction':'en',uk:'en',au:'en',sg:'en',unverified:'en'};
function v05LegalSourceLanguage(profileCode=v04Jurisdiction){return V05_LEGAL_SOURCE_LANGUAGE[profileCode]||'en';}
function v05LegalSourceLabel(documentCode=currentUiLanguage,profileCode=v04Jurisdiction){
  const sourceCode=v05LegalSourceLanguage(profileCode);
  return `${v04Terms(documentCode)[1]}: ${v05BilingualLanguageName(sourceCode,documentCode)}`;
}
