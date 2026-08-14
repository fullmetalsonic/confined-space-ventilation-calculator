<#!
v0.5 단일 HTML을 src/의 CSS·기능별 JavaScript 소스로 분리하는 PowerShell 변환기.
기준 파일을 실행하지 않으며, 코드의 위치만 분리한다.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'dist\html\밀폐공간_환기량_산정_도구_v0.5.html'
$webRoot = Join-Path $root 'src'
$scriptRoot = Join-Path $webRoot 'scripts'
$styleRoot = Join-Path $webRoot 'styles'
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Write-Utf8File([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content.Replace("`r`n", "`n"), $utf8)
}

function Get-Section([string]$Text, [string]$Start, [string]$End) {
    $startIndex = $Text.IndexOf($Start, [System.StringComparison]::Ordinal)
    $endIndex = $Text.IndexOf($End, $startIndex, [System.StringComparison]::Ordinal)
    if ($startIndex -lt 0 -or $endIndex -lt 0) {
        throw "분할 표식을 찾지 못했습니다: $Start -> $End"
    }
    return $Text.Substring($startIndex, $endIndex - $startIndex).TrimEnd() + "`n"
}

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "기준 배포본이 없습니다: $sourcePath"
}

$source = [System.IO.File]::ReadAllText($sourcePath, [System.Text.Encoding]::UTF8)
$styles = [regex]::Matches($source, '<style(?<attrs>[^>]*)>(?<css>[\s\S]*?)</style>')
$scripts = [regex]::Matches($source, '<script(?<attrs>[^>]*)>(?<js>[\s\S]*?)</script>')
if ($styles.Count -ne 5 -or $scripts.Count -ne 2) {
    throw "기준 HTML의 style/script 블록 수가 예상과 다릅니다: style=$($styles.Count), script=$($scripts.Count)"
}

New-Item -ItemType Directory -Force -Path $scriptRoot, $styleRoot | Out-Null
$baseCss = (($styles[0..3] | ForEach-Object { $_.Groups['css'].Value.Trim() }) -join "`n`n") + "`n"
Write-Utf8File (Join-Path $styleRoot 'app.css') $baseCss
Write-Utf8File (Join-Path $styleRoot 'v05.css') ($styles[4].Groups['css'].Value.Trim() + "`n")
$javascript = $scripts[0].Groups['js'].Value
$sections = @(
    @('core', 'const state = {', 'const UI_LANGUAGE_META = ['),
    @('i18n', 'const UI_LANGUAGE_META = [', 'function renderStepper(){'),
    @('navigation', 'function renderStepper(){', 'function selectMode(m){'),
    @('geometry', 'function selectMode(m){', 'function renderStep3(){'),
    @('calculations', 'function renderStep3(){', 'function addFanRow(name, rated, eff, explosion){'),
    @('fans', 'function addFanRow(name, rated, eff, explosion){', 'function printReport(){'),
    @('platform', 'function printReport(){', 'function modeName(m){'),
    @('reporting', 'function modeName(m){', 'function serializeSession(){'),
    @('session', 'function serializeSession(){', 'function initGuidanceAccordion(){'),
    @('init', 'function initGuidanceAccordion(){', "document.addEventListener('DOMContentLoaded', ()=>{")
)
foreach ($section in $sections) {
    Write-Utf8File (Join-Path $scriptRoot ($section[0] + '.js')) (Get-Section $javascript $section[1] $section[2])
}
$bootstrapStart = $javascript.IndexOf("document.addEventListener('DOMContentLoaded', ()=>{", [System.StringComparison]::Ordinal)
if ($bootstrapStart -lt 0) { throw '초기화 이벤트를 찾지 못했습니다.' }
Write-Utf8File (Join-Path $scriptRoot 'bootstrap.js') ($javascript.Substring($bootstrapStart).Trim() + "`n")
Write-Utf8File (Join-Path $scriptRoot 'v05.js') ($scripts[1].Groups['js'].Value.Trim() + "`n")

$externalStyle = '<link rel="stylesheet" href="styles/app.css">'
$tags = ($sections | ForEach-Object { '  <script src="scripts/' + $_[0] + '.js"></script>' }) -join "`n"
$baseScriptTags = $tags + "`n  <script src=`"scripts/bootstrap.js`"></script>"
$html = $source.Replace($styles[0].Value, $externalStyle)
$styles[1..3] | ForEach-Object { $html = $html.Replace($_.Value, '') }
$html = $html.Replace($scripts[0].Value, $baseScriptTags)
$html = $html.Replace($styles[4].Value, '<link rel="stylesheet" href="styles/v05.css">')
$html = $html.Replace($scripts[1].Value, '<script src="scripts/v05.js"></script>')
Write-Utf8File (Join-Path $webRoot 'index.html') $html
Write-Output '모듈 소스 생성: src'
