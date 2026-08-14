<#! 선택한 단일 HTML 배포본을 Windows app.py의 Base64 내장본으로 반영한다. #>
[CmdletBinding()]
param(
    [string]$HtmlPath = '',
    [string]$AppPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $HtmlPath) { $HtmlPath = Join-Path $root 'dist\html\밀폐공간_환기량_산정_도구_v0.6.html' }
if (-not $AppPath) { $AppPath = Join-Path $root 'app.py' }
$html = [System.IO.File]::ReadAllBytes([System.IO.Path]::GetFullPath($HtmlPath))
$encoded = [Convert]::ToBase64String($html)
$chunks = for ($offset = 0; $offset -lt $encoded.Length; $offset += 100) {
    '    "' + $encoded.Substring($offset, [Math]::Min(100, $encoded.Length - $offset)) + '"'
}
$replacement = "_HTML_B64 = (`n" + ($chunks -join "`n") + "`n)`n`n"
$appFullPath = [System.IO.Path]::GetFullPath($AppPath)
$app = [System.IO.File]::ReadAllText($appFullPath, [System.Text.Encoding]::UTF8)
$pattern = '(?s)_HTML_B64 = \(\r?\n.*?\r?\n\)\r?\n\r?\n(?=def get_html\(\):)'
if (-not [regex]::IsMatch($app, $pattern)) { throw 'app.py에서 _HTML_B64 블록을 정확히 하나 찾지 못했습니다.' }
$updated = [regex]::Replace($app, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement }, 1)
[System.IO.File]::WriteAllText($appFullPath, $updated.Replace("`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
Write-Output "동기화 완료: $(Split-Path -Leaf $HtmlPath) -> $(Split-Path -Leaf $AppPath) ($($html.Length) bytes)"
