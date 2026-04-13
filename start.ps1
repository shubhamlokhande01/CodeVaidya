# start.ps1 — Aarogya AI
# Starts the backend API server.
# Open frontend/index.html in your browser after running this.

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Aarogya AI — Project Launcher" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Detect virtual environment
$venvPython = $null
if (Test-Path "d:\Vaidya11\venv\Scripts\python.exe") {
    $venvPython = "d:\Vaidya11\venv\Scripts\python.exe"
    Write-Host "[OK] Using venv Python: $venvPython" -ForegroundColor Green
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $venvPython = "python"
    Write-Host "[OK] Using system Python" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Python not found. Install Python 3.9+ and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting backend (FastAPI on http://127.0.0.1:8000)..." -ForegroundColor Yellow
Write-Host "Open  d:\Vaidya11\frontend\index.html  in your browser." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Set-Location "d:\Vaidya11\backend"
& $venvPython -m uvicorn backend_api:app --host 0.0.0.0 --port 8000 --reload
