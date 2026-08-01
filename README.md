# 밀폐공간 환기량 산정 도구

Produced by H.S.H

밀폐공간의 최초 급기량·유지 환기량을 계산하고, 보유 송배풍기의 실질풍량과
필요 대수를 비교하는 오프라인 도구입니다.

> 이 도구의 계산값은 설계·계획 참고용입니다. 실제 작업 전·중에는 관계 법령과
> 사업장 절차에 따라 산소 및 유해가스 농도를 현장에서 실측해야 합니다.

## 가장 쉬운 실행 방법

최신 글로벌판은 `dist/html/밀폐공간_환기량_산정_도구_v0.5.html`입니다.
더블클릭하면 별도 설치 없이 PC·휴대기기 브라우저에서 오프라인으로 실행됩니다.

Android 설치 파일은 `dist/android/밀폐공간_환기량_산정_도구_v0.5.apk`에 있습니다.
이 APK는 자체 서명된 사내용 빌드이므로 설치 시 출처 확인 경고가 표시될 수
있습니다.

Windows 단일 실행 파일은
`dist/windows/밀폐공간_환기량_산정_도구_v0.5.exe`에 있습니다.

v0.4도 HTML·EXE·APK 세 가지 형식으로 함께 보관되어 있으며, v0.5는 법규 프로필 운영 정보,
지역별 문서 설정 추천과 기기 내부 임시저장을 추가한 최신판입니다.

## 폴더 구조

```text
.
├─ 밀폐공간_환기량_산정_도구.html  # 웹 버전의 기준 원본
├─ app.py                           # Windows pywebview 래퍼(HTML 내장)
├─ requirements.txt                 # Windows 실행·빌드 의존성
├─ PROJECT_STATE.md                 # 현재 구조, 제약, 후속 작업 안내
├─ assets/
│  ├─ icon.ico                      # Windows 실행 파일 아이콘
│  └─ app-icon.png                  # 앱 아이콘 원본
├─ android/                          # Android WebView 래퍼 원본
│  ├─ AndroidManifest.xml
│  ├─ res/
│  └─ src/
├─ dist/
│  ├─ html/
│  │  └─ 밀폐공간_환기량_산정_도구_v0.3.html
│  ├─ android/
│  │  └─ 밀폐공간_환기량_산정_도구_v0.3.apk
│  └─ windows/
│     └─ 밀폐공간_환기량_산정_도구_v0.3.exe
├─ docs/
│  ├─ 밀폐공간_환기량_산정_툴_기획안.docx
│  └─ 프로젝트_이력_기록.md
└─ scripts/
   ├─ build_android.ps1             # v0.3 APK 빌드·정렬·서명·검증
   ├─ build_windows.ps1             # v0.3 단일 EXE 빌드
   ├─ sync_desktop_html.py          # HTML을 app.py 내장본에 반영
   └─ verify_project.py              # 파일 관계와 기본 구조 검증
```

## Windows 앱 실행 및 빌드

PowerShell 또는 명령 프롬프트에서 이 폴더로 이동한 뒤 실행합니다.

```powershell
python -m pip install -r requirements.txt
python app.py
```

준비된 빌드 스크립트로 단일 EXE 빌드:

```powershell
.\scripts\build_windows.ps1 -PythonExe "python.exe" -Version v0.5 -HtmlPath .\dist\html\밀폐공간_환기량_산정_도구_v0.5.html
```

결과는 지정한 버전명의 `dist/windows/`에 생성됩니다.

## Android APK 빌드

JDK 17과 Android SDK platform/build-tools 35 경로가 준비된 환경에서:

```powershell
.\scripts\build_android.ps1 -Version v0.5 -HtmlPath .\dist\html\밀폐공간_환기량_산정_도구_v0.5.html
```

결과는 지정한 버전명의 `dist/android/`에 생성됩니다.
스크립트는 현재 HTML과 `assets/app-icon.png`를 APK에 포함하고, 정렬·서명 검증을
통과한 경우에만 배포 파일을 교체합니다.

## 개발할 때 지킬 순서

1. 웹 기능은 `밀폐공간_환기량_산정_도구.html`에서 수정합니다.
2. `python scripts/sync_desktop_html.py`로 `app.py`의 내장 HTML을 갱신합니다.
3. `python scripts/verify_project.py`로 웹·Windows·APK 내장본의 차이를 확인합니다.
4. 사용자가 요청할 때만 EXE 또는 APK를 다시 빌드합니다.

상세한 현재 상태와 알려진 제약은 `PROJECT_STATE.md`를 참고하세요.
