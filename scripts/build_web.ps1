<#! 분리된 src 웹 소스를 설치 없이 실행할 수 있는 단일 HTML 배포본으로 묶는다. #>
[CmdletBinding()]
param(
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $root 'src'
if (-not $OutputPath) {
    $OutputPath = Join-Path $root 'dist\html\밀폐공간_환기량_산정_도구_v0.6.html'
}
$utf8 = [System.Text.UTF8Encoding]::new($false)
$indexPath = Join-Path $webRoot 'index.html'
$cssPath = Join-Path $webRoot 'styles\app.css'
$html = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$css = [System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8).TrimEnd()
$styleLink = '<link rel="stylesheet" href="styles/app.css">'
if (-not $html.Contains($styleLink)) { throw 'src/index.html에서 스타일 링크를 찾지 못했습니다.' }
$html = $html.Replace($styleLink, "<style>`n$css`n</style>")
$v05Css = [System.IO.File]::ReadAllText((Join-Path $webRoot 'styles\v05.css'), [System.Text.Encoding]::UTF8).TrimEnd()
$v05StyleLink = '<link rel="stylesheet" href="styles/v05.css">'
if (-not $html.Contains($v05StyleLink)) { throw 'src/index.html에서 v0.5 스타일 링크를 찾지 못했습니다.' }
$html = $html.Replace($v05StyleLink, "<style id=`"global-v05-operations`">`n$v05Css`n</style>")

$names = @('core','i18n','navigation','geometry','calculations','fans','platform','reporting','session','profile-display','legal-source-language','init','bootstrap','v05')
foreach ($name in $names) {
    $tag = '<script src="scripts/' + $name + '.js"></script>'
    if (-not $html.Contains($tag)) { throw "스크립트 태그가 없습니다: $name" }
    $content = [System.IO.File]::ReadAllText((Join-Path $webRoot "scripts\$name.js"), [System.Text.Encoding]::UTF8).TrimEnd()
    $html = $html.Replace($tag, "<script>`n$content`n</script>")
}

$target = [System.IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
[System.IO.File]::WriteAllText($target, $html.Replace("`r`n", "`n"), $utf8)
$pagesTarget = Join-Path $root 'docs\index.html'
[System.IO.File]::WriteAllText($pagesTarget, $html.Replace("`r`n", "`n"), $utf8)
$bytes = [System.IO.FileInfo]::new($target).Length
Write-Output "HTML 배포본 생성: $target ($bytes bytes); Pages 공개본 동기화: $pagesTarget"
