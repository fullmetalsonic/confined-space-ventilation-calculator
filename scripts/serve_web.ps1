<#! v0.6 배포 HTML을 실제 브라우저 검수용 localhost로 제공한다. #>
[CmdletBinding()]
param(
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $root 'dist\html'
$defaultFile = '밀폐공간_환기량_산정_도구_v0.6.html'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Output "Serving http://127.0.0.1:$Port/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $relative = [uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = $defaultFile }
        $candidate = [System.IO.Path]::GetFullPath((Join-Path $webRoot $relative))
        $allowedRoot = [System.IO.Path]::GetFullPath($webRoot) + [System.IO.Path]::DirectorySeparatorChar
        if (-not $candidate.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
        }
        $bytes = [System.IO.File]::ReadAllBytes($candidate)
        $context.Response.ContentType = if ($candidate.EndsWith('.html')) { 'text/html; charset=utf-8' } else { 'application/octet-stream' }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.Close()
    }
} finally {
    $listener.Close()
}
