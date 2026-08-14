<#! src 모듈 구조, v0.6 단일 HTML, Windows 내장본의 일관성을 정적으로 검증한다. #>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = [System.Text.Encoding]::UTF8
$sourceIndex = Join-Path $root 'src\index.html'
$bundle = Join-Path $root 'dist\html\밀폐공간_환기량_산정_도구_v0.6.html'
$app = Join-Path $root 'app.py'
$names = @('core','i18n','navigation','geometry','calculations','fans','platform','reporting','session','init','bootstrap','v05')
$failures = [System.Collections.Generic.List[string]]::new()

foreach ($name in $names) {
    $path = Join-Path $root "src\scripts\$name.js"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $failures.Add("누락된 모듈: src/scripts/$name.js"); continue }
    $content = [System.IO.File]::ReadAllText($path, $utf8)
    if ([string]::IsNullOrWhiteSpace($content)) { $failures.Add("비어 있는 모듈: src/scripts/$name.js") }
}
if (-not (Test-Path -LiteralPath $sourceIndex)) { $failures.Add('누락된 소스 HTML: src/index.html') }
if (-not (Test-Path -LiteralPath $bundle)) { $failures.Add('누락된 배포 HTML: dist/html/...v0.6.html') }
if (-not (Test-Path -LiteralPath $app)) { $failures.Add('누락된 Windows 래퍼: app.py') }
foreach ($name in @('app.css','v05.css')) {
    if (-not (Test-Path -LiteralPath (Join-Path $root "src\styles\$name") -PathType Leaf)) { $failures.Add("누락된 스타일: src/styles/$name") }
}
if ($failures.Count) { $failures | ForEach-Object { Write-Output "[FAIL] $_" }; exit 1 }

$source = [System.IO.File]::ReadAllText($sourceIndex, $utf8)
if ($source -match '(?m)^\s*<style>\s*$' -or $source -match '(?m)^\s*<script>\s*$') { $failures.Add('src/index.html에 분리되지 않은 인라인 style/script가 있습니다.') }
foreach ($name in $names) {
    if (-not $source.Contains('<script src="scripts/' + $name + '.js"></script>')) { $failures.Add("src/index.html에 모듈 태그가 없습니다: $name") }
}
if (-not $source.Contains('<link rel="stylesheet" href="styles/app.css">')) { $failures.Add('src/index.html에 styles/app.css 링크가 없습니다.') }
if (-not $source.Contains('<link rel="stylesheet" href="styles/v05.css">')) { $failures.Add('src/index.html에 styles/v05.css 링크가 없습니다.') }

$bundleText = [System.IO.File]::ReadAllText($bundle, $utf8)
if ($bundleText -match 'src="scripts/' -or $bundleText -match 'href="styles/app.css"') { $failures.Add('v0.6 배포 HTML에 외부 소스 경로가 남아 있습니다.') }
if (([regex]::Matches($bundleText, '(?m)^\s*<style(?:\s|>)')).Count -ne 2 -or ([regex]::Matches($bundleText, '(?m)^\s*<script>\s*$')).Count -ne $names.Count) { $failures.Add('v0.6 배포 HTML의 인라인 번들 구조가 예상과 다릅니다.') }

$appText = [System.IO.File]::ReadAllText($app, $utf8)
$match = [regex]::Match($appText, '(?s)_HTML_B64 = \(\r?\n(?<body>.*?)\r?\n\)\r?\n\r?\n(?=def get_html\(\):)')
if (-not $match.Success) {
    $failures.Add('app.py의 _HTML_B64 블록을 읽을 수 없습니다.')
} else {
    $joined = (($match.Groups['body'].Value -split "`n") | ForEach-Object { $_.Trim().Trim('"') }) -join ''
    try {
        $embedded = [Convert]::FromBase64String($joined)
        $expected = [System.IO.File]::ReadAllBytes($bundle)
        if (-not [System.Linq.Enumerable]::SequenceEqual([byte[]]$embedded, [byte[]]$expected)) { $failures.Add('app.py 내장 HTML이 v0.6 배포 HTML과 다릅니다.') }
    } catch { $failures.Add("app.py 내장 HTML Base64 해석 실패: $($_.Exception.Message)") }
}

if ($failures.Count) {
    $failures | ForEach-Object { Write-Output "[FAIL] $_" }
    exit 1
}
Write-Output "[PASS] 모듈 $($names.Count)개, src 외부 참조, v0.6 단일 번들, app.py 내장본 일치"
