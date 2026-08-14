param(
    [string]$JdkHome = "",
    [string]$SdkRoot = "",
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v\d+\.\d+$')]
    [string]$Version,
    [Parameter(Mandatory = $true)]
    [string]$HtmlPath
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$html = (Resolve-Path $HtmlPath).Path
if (-not (Test-Path -LiteralPath $html)) { throw "HTML 파일을 찾지 못했습니다: $html" }
$versionCode = [int](($Version -replace '^v','') -replace '\.','')

if (-not $JdkHome) {
    $jdkCandidate = Get-ChildItem -Directory (Join-Path $root ".build\tools\jdk") |
        Select-Object -First 1
    if (-not $jdkCandidate) {
        throw "JDK를 찾지 못했습니다. -JdkHome으로 JDK 17 경로를 지정하세요."
    }
    $JdkHome = $jdkCandidate.FullName
} else {
    $JdkHome = (Resolve-Path $JdkHome).Path
}
if (-not $SdkRoot) {
    $SdkRoot = Join-Path $root ".build\android-sdk"
} else {
    $SdkRoot = (Resolve-Path $SdkRoot).Path
}

$buildTools = Get-ChildItem -LiteralPath (Join-Path $SdkRoot "build-tools") -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
$platform = Get-ChildItem -LiteralPath (Join-Path $SdkRoot "platforms") -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^android-\d+(?:\.\d+)?$' } |
    Sort-Object { [version]($_.Name -replace '^android-','') } -Descending |
    Select-Object -First 1
if (-not $buildTools -or -not $platform) {
    throw "Android SDK Build-Tools 또는 플랫폼을 찾지 못했습니다: $SdkRoot"
}
$buildTools = $buildTools.FullName
$androidJar = Join-Path $platform.FullName "android.jar"
$aapt2 = Join-Path $buildTools "aapt2.exe"
$aapt = Join-Path $buildTools "aapt.exe"
$d8 = Join-Path $buildTools "d8.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"
$javac = Join-Path $JdkHome "bin\javac.exe"
$jar = Join-Path $JdkHome "bin\jar.exe"
$keytool = Join-Path $JdkHome "bin\keytool.exe"

foreach ($required in @($androidJar, $aapt2, $aapt, $d8, $zipalign, $apksigner, $javac, $jar, $keytool)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "필수 빌드 도구가 없습니다: $required"
    }
}

$tempRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$safeVersion = $Version.Replace('.', '_')
$work = Join-Path $tempRoot "ventcalc-$safeVersion-android-work"
$resolvedWork = [System.IO.Path]::GetFullPath($work)
if (
    $resolvedWork -eq $tempRoot -or
    -not $resolvedWork.StartsWith($tempRoot + [System.IO.Path]::DirectorySeparatorChar)
) {
    throw "안전하지 않은 빌드 경로입니다: $resolvedWork"
}
if (Test-Path -LiteralPath $work) {
    Remove-Item -LiteralPath $work -Recurse -Force
}

$res = Join-Path $work "res"
$assets = Join-Path $work "assets"
$classes = Join-Path $work "classes"
$dex = Join-Path $work "dex"
$generated = Join-Path $work "generated"
$javaSrc = Join-Path $work "src"
$manifest = Join-Path $work "AndroidManifest.xml"
$localAndroidJar = Join-Path $work "android.jar"
New-Item -ItemType Directory -Force -Path $res | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null
New-Item -ItemType Directory -Force -Path $classes | Out-Null
New-Item -ItemType Directory -Force -Path $dex | Out-Null
New-Item -ItemType Directory -Force -Path $generated | Out-Null
New-Item -ItemType Directory -Force -Path $javaSrc | Out-Null

Copy-Item -Path (Join-Path $root "android\res\*") -Destination $res -Recurse -Force
Copy-Item -Path (Join-Path $root "android\src\*") -Destination $javaSrc -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root "android\AndroidManifest.xml") -Destination $manifest -Force
Copy-Item -LiteralPath $androidJar -Destination $localAndroidJar -Force
New-Item -ItemType Directory -Force -Path (Join-Path $res "drawable") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "assets\app-icon.png") -Destination (Join-Path $res "drawable\app_icon.png") -Force
Copy-Item -LiteralPath $html -Destination (Join-Path $assets "index.html") -Force

$compiled = Join-Path $work "compiled-res.zip"
$unaligned = Join-Path $work "app-unsigned-unaligned.apk"
$aligned = Join-Path $work "app-unsigned-aligned.apk"
$signed = Join-Path $work "app-$safeVersion-signed.apk"

& $aapt2 compile --dir $res -o $compiled
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile 실패" }

& $aapt2 link `
    -o $unaligned `
    -I $localAndroidJar `
    --manifest $manifest `
    --min-sdk-version 23 `
    --target-sdk-version 35 `
    --version-code $versionCode `
    --version-name ($Version -replace '^v','') `
    --java $generated `
    -A $assets `
    $compiled
if ($LASTEXITCODE -ne 0) { throw "aapt2 link 실패" }

$javaSources = Get-ChildItem -LiteralPath $javaSrc -Recurse -Filter "*.java" |
    ForEach-Object { $_.FullName }
& $javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $localAndroidJar -d $classes $javaSources
if ($LASTEXITCODE -ne 0) { throw "javac 실패" }

$classesJar = Join-Path $work "classes.jar"
& $jar cf $classesJar -C $classes .
if ($LASTEXITCODE -ne 0) { throw "classes.jar 생성 실패" }

$env:JAVA_HOME = $JdkHome
& $d8 --min-api 23 --lib $localAndroidJar --output $dex $classesJar
if ($LASTEXITCODE -ne 0) { throw "d8 실패" }

Push-Location $dex
try {
    & $aapt add $unaligned "classes.dex"
    if ($LASTEXITCODE -ne 0) { throw "classes.dex APK 추가 실패" }
} finally {
    Pop-Location
}

& $zipalign -f 4 $unaligned $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign 실패" }

$signingDir = Join-Path $root ".build\android-signing"
$keystore = Join-Path $signingDir "ventcalc-internal.jks"
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null
if (-not (Test-Path -LiteralPath $keystore)) {
    & $keytool -genkeypair -v `
        -keystore $keystore `
        -storepass android `
        -keypass android `
        -alias androiddebugkey `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname "CN=VentCalc Internal, OU=Internal, O=HSH, L=Seoul, C=KR"
    if ($LASTEXITCODE -ne 0) { throw "서명키 생성 실패" }
}

& $apksigner sign `
    --ks $keystore `
    --ks-key-alias androiddebugkey `
    --ks-pass pass:android `
    --key-pass pass:android `
    --out $signed `
    $aligned
if ($LASTEXITCODE -ne 0) { throw "APK 서명 실패" }

& $apksigner verify --verbose --print-certs $signed
if ($LASTEXITCODE -ne 0) { throw "APK 서명 검증 실패" }

$outputDir = Join-Path $root "dist\android"
$output = Join-Path $outputDir "밀폐공간_환기량_산정_도구_$Version.apk"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Copy-Item -LiteralPath $signed -Destination $output -Force

Write-Output "APK 빌드 완료: $output"
