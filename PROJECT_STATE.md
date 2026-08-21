# 프로젝트 현재 상태 / Project Status

> **English overview:** This file is a Korean technical status record. The
> current editable product source is `src/`; generated HTML, desktop, and
> Android artifacts must be rebuilt and verified after source changes. For the
> illustrated end-user workflow, see `docs/user-guide.html`.

마지막 정리: 2026-07-31

## 1. 한눈에 보는 구조

이 프로젝트의 실제 제품 로직은 단일 HTML 파일의 CSS와 JavaScript에 있습니다.

```text
밀폐공간_환기량_산정_도구.html (기준 원본)
          ├─ app.py 안에 Base64로 내장 → Windows pywebview/PyInstaller
          └─ APK의 assets/index.html  → Android WebView
```

v0.3 빌드 시점에는 세 HTML 사본의 바이트와 SHA-256 해시가 모두 일치했습니다.

v0.4는 글로벌 안전 프로필·입력/JSON 검증·접근성·A4/Letter 인쇄 설정을 갖춘 배포본이며,
v0.5는 법규 프로필 운영 정보·지역별 문서 설정 추천·기기 내부 임시저장을 추가한 최신 글로벌 배포본입니다.
각 버전은 HTML·Windows EXE·Android APK로 별도 생성되었습니다.

## 2. 현재 구현된 주요 기능

- 6단계 마법사: 계산방식 → 체적 → 작업조건 → 계산결과 → 송배풍기 → 리포트
- 체적배수법, 희석법 A(발생량 입력), 희석법 B(농도 측정 역산)
- 여러 형상 구역의 합산·차감과 유효공간율 보정
- 송배풍기 유효풍량, 필요 대수, 여유율 계산
- 정격×유효율, 제조사 운전점, 현장 실측풍량 중 적용방식 선택
- 선택형 덕트 직경·길이·굴곡·정압 기록과 덕트 평균풍속 표시
- 풍량 단위 변환
- 세션 및 장비 목록 JSON 저장·불러오기
- A4 인쇄용 결과서, 작성자·확인자 서명란, 31개 언어 선택형 보조 페이지
- 한국어 포함 32개 화면 언어와 PC·모바일용 언어 선택 UI
- PC·모바일 반응형 UI
- 브라우저, Windows pywebview, Android WebView별 저장·인쇄 분기

## 3. 파일별 역할과 기준

### 기준 원본

`밀폐공간_환기량_산정_도구.html`

- CSS, 화면 마크업, 계산식, 상태 관리가 모두 들어 있는 단일 파일입니다.
- 기능 변경은 이 파일에서 먼저 수행합니다.

### Windows 래퍼

`app.py`

- HTML 전체를 `_HTML_B64`에 내장합니다.
- pywebview의 저장 대화상자를 JavaScript API로 연결합니다.
- `debug=True`와 `OPEN_DEVTOOLS_IN_DEBUG=False` 조합은 과거 Windows 실기기에서
  저장 API가 정상 응답하도록 유지한 경험적 호환 설정입니다.

### HTML 배포물

`dist/html/밀폐공간_환기량_산정_도구_v0.3.html`

- 설치 없이 PC·모바일 브라우저에서 사용할 수 있는 v0.3 배포본입니다.
- 루트의 기준 원본과 바이트 단위로 일치합니다.

`dist/html/밀폐공간_환기량_산정_도구_v0.4.html`

- 글로벌 기능 배포본입니다.
- 화면 언어와 안전 기준 관할을 분리하고, 한국·미국 일반산업·미국 건설업·
  회사 표준·공학 참고 프로필을 제공합니다.
- 엄격한 입력/JSON 검증, 사용자 문자열 이스케이프, RTL·현지 숫자/날짜,
  키보드 접근성, A4/US Letter 선택을 추가했습니다.
- 동 버전 EXE와 APK 내부 HTML과 바이트 단위로 대응합니다.

`dist/html/밀폐공간_환기량_산정_도구_v0.5.html`

- 최신 글로벌 배포본입니다.
- 일본·브라질을 포함한 9개 법규 프로필, 프로필 검토·승인 상태, 지역별 문서 설정 추천,
  기기 내부 임시저장을 추가했습니다.
- 동 버전 EXE와 APK 내부 HTML과 바이트 단위로 대응합니다.

### Android 배포물

`dist/android/밀폐공간_환기량_산정_도구_v0.3.apk`

- `assets/index.html`에 웹 원본을 포함한 자체 서명 APK입니다.
- v0.3 빌드 시점에는 APK 안의 HTML이 기준 원본과 일치합니다.
- AndroidManifest, Java 소스, 리소스, 빌드 스크립트는 `android/`와
  `scripts/build_android.ps1`에 있어 다시 빌드할 수 있습니다.
- 패키지명은 `kr.hsh.ventcalc`, 버전은 0.3, 최소 API 23, 대상 API 35입니다.
- 새 자체 서명키를 사용했으므로 이전 APK가 설치된 기기에서는 기존 앱을 삭제한 뒤
  설치해야 합니다.

`dist/android/밀폐공간_환기량_산정_도구_v0.4.apk`,
`dist/android/밀폐공간_환기량_산정_도구_v0.5.apk`

- 동일한 내부 서명키로 생성되었고, 각각 같은 버전의 HTML을 `assets/index.html`에 포함합니다.
- APK 서명 v1·v2·v3 검증과 HTML 바이트 일치 검증을 완료했습니다.

### 문서

`docs/밀폐공간_환기량_산정_툴_기획안.docx`

- 개발 초기 초안입니다. 현재 앱의 최종 사양 문서가 아닙니다.
- 예를 들어 초기 급기 기본값을 5배로 기술한 부분이 있으나, 현재 앱과 개발 이력은
  10배를 사용합니다. 요구사항 기준으로 직접 사용하면 안 됩니다.
- 문서 구조는 1개 섹션, 4개 표, 107개 유효 문단으로 확인되었습니다.
- 현재 환경에는 LibreOffice가 없어 페이지 이미지 기반 시각 검수는 완료하지 못했습니다.

`docs/프로젝트_이력_기록.md`

- Claude 작업 과정과 의사결정을 시간 순서로 기록한 참고 자료입니다.
- 결과를 재현하는 자동 테스트나 빌드 스크립트를 대신하지는 않습니다.

## 4. 현재 가장 중요한 기술 부채

1. HTML이 한 파일에 CSS·마크업·JavaScript로 결합되어 변경 영향 범위가 큽니다.
2. `app.py`가 HTML을 복제 저장하므로 동기화가 필요합니다.
3. Android 빌드 도구와 자체 서명키가 `.build/`에 있으므로, 다른 PC에서 재현할 때는
   JDK·Android SDK 경로를 다시 준비해야 합니다.
4. 구조·동기화 검증 스크립트는 있으나 브라우저 전 단계 UI 회귀 테스트는 아직 별도
   테스트 모음으로 고정되어 있지 않습니다.
5. 법령·KOSHA GUIDE·허용농도 등 안전 관련 기준은 별도 데이터 계층이 아니라 화면과
   코드에 섞여 있어 최신성 검토와 변경 추적이 어렵습니다.
6. 초기 기획서와 현재 구현 사이에 사양 차이가 있습니다.
7. v0.3 안정판에는 사용자 입력 이스케이프, 엄격한 JSON 스키마 검사, 계산 직전
   실패 안전 검증이 아직 없습니다. v0.4 HTML 시험판에서 우선 구현했습니다.
8. v0.4 글로벌 기능은 자동 브라우저 연결이 없는 상태에서 정적 검증까지만 완료했으므로,
   실제 모바일·RTL·A4/Letter 인쇄 미리보기 회귀 검수가 필요합니다.

## 5. 다음 작업 권장 순서

1. 현재 계산 시나리오를 고정하는 회귀 테스트부터 복구합니다.
2. v0.4 HTML의 입력값 범위 검증, JSON 스키마 검증, HTML 이스케이프를
   실제 브라우저·모바일에서 회귀 검수합니다.
3. v0.4의 관할 프로필과 출처 객체를 검토해 승인된 회사 표준을 추가합니다.
4. JavaScript를 상태, 계산 엔진, 저장/불러오기, UI 렌더링 모듈로 단계적으로 나눕니다.
5. Android 실기기에서 인쇄, JSON 저장·불러오기, 화면 회전까지 최종 확인합니다.
6. 현재 구현 기준의 사양서와 사용자 매뉴얼을 새로 작성합니다.

## 6. 변경 전 필수 확인

- EXE는 `scripts/build_windows.ps1 -PythonExe "python.exe" -Version v0.5 -HtmlPath .\dist\html\밀폐공간_환기량_산정_도구_v0.5.html` 형식으로 빌드합니다.
- APK는 `scripts/build_android.ps1 -Version v0.5 -HtmlPath .\dist\html\밀폐공간_환기량_산정_도구_v0.5.html` 형식으로 빌드합니다.
- 검증에서 HTML 사본 불일치가 나오면 배포하지 않습니다.
- 안전 관련 산식이나 기준값 변경은 공식 최신 원문을 다시 확인하고 근거를 기록합니다.
- 계산값은 실측을 대체하지 않는다는 고지와 실패 시 안전한 방향의 입력 검증을 유지합니다.
