param(
    [Parameter(Mandatory = $true)]
    [string]$PythonExe,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v\d+\.\d+$')]
    [string]$Version,
    [Parameter(Mandatory = $true)]
    [string]$HtmlPath
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$html = (Resolve-Path $HtmlPath).Path
$packages = Join-Path $root ".build\python-packages"
if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw "Python 실행파일을 찾지 못했습니다: $PythonExe"
}
if (-not (Test-Path -LiteralPath (Join-Path $packages "PyInstaller"))) {
    throw "PyInstaller 패키지가 없습니다: $packages"
}
if (-not (Test-Path -LiteralPath $html)) {
    throw "HTML 파일을 찾지 못했습니다: $html"
}

$env:PYTHONPATH = if ($env:PYTHONPATH) { "$packages;$env:PYTHONPATH" } else { $packages }
$output = Join-Path $root "dist\windows"
$safeVersion = $Version.Replace('.', '_')
$buildRoot = Join-Path $root (".build\windows-build\ventcalc-$safeVersion-windows-" + [Guid]::NewGuid().ToString("N"))
$work = Join-Path $buildRoot "work"
$spec = Join-Path $buildRoot "spec"
$tempOutput = Join-Path $buildRoot "dist"
$tempName = "VentCalc_$safeVersion"
$finalExe = Join-Path $output "밀폐공간_환기량_산정_도구_$Version.exe"
New-Item -ItemType Directory -Force -Path $work, $spec, $tempOutput, $output | Out-Null
$stagedApp = Join-Path $buildRoot "app.py"
Copy-Item -LiteralPath (Join-Path $root "app.py") -Destination $stagedApp -Force
& $PythonExe (Join-Path $root "scripts\sync_desktop_html.py") --html $html --app $stagedApp
if ($LASTEXITCODE -ne 0) { throw "선택 HTML을 EXE에 내장하지 못했습니다." }

& $PythonExe -m PyInstaller `
    --noconfirm `
    --onefile `
    --noconsole `
    --name $tempName `
    --icon (Join-Path $root "assets\icon.ico") `
    --workpath $work `
    --specpath $spec `
    --distpath $tempOutput `
    $stagedApp
if ($LASTEXITCODE -ne 0) {
    throw "Windows EXE 빌드 실패"
}

Copy-Item -LiteralPath (Join-Path $tempOutput "$tempName.exe") -Destination $finalExe -Force
Write-Output "EXE 빌드 완료: $finalExe"
