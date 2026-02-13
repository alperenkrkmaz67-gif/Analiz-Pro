# Simple Header Update Script
$files = @(
    "dedicated_analysis.html",
    "opening_analysis.html", 
    "full_analysis.html",
    "vip.html",
    "profile.html",
    "info.html",
    "admin.html"
)

$simpleHeader = @'
<header>
    <div class="container">
        <nav style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
            <!-- Back Button -->
            <a href="index.html" class="btn btn-outline" style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
                ← Ana Sayfa
            </a>
            
            <!-- Logo -->
            <a href="index.html" class="logo" style="font-size: 1.3rem; font-weight: 800; background: linear-gradient(to right, var(--primary-color), var(--accent-color)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">
                Analiz Pro
            </a>
        </nav>
    </div>
</header>
'@

foreach ($file in $files) {
    $filePath = $file
    if (Test-Path $filePath) {
        Write-Host "Updating $file..." -ForegroundColor Green
        
        $content = Get-Content $filePath -Raw
        
        # Replace header section
        $pattern = '(?s)<header>.*?</header>'
        $newContent = $content -replace $pattern, $simpleHeader
        
        Set-Content -Path $filePath -Value $newContent -NoNewline
        Write-Host "Updated $file" -ForegroundColor Cyan
    } else {
        Write-Host "Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "All files updated successfully!" -ForegroundColor Green
