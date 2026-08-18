Write-Host "Starting House Valuation System Backend Server..." -ForegroundColor Green

# Change to backend directory
Set-Location -Path "$PSScriptRoot\backend"

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python detected: $pythonVersion" -ForegroundColor Yellow
} 
catch {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org/downloads/" -ForegroundColor Red
    Pause
    exit 1
}

# Install dependencies
Write-Host "Installing required packages..." -ForegroundColor Cyan
python -m pip install --upgrade pip
pip install -r requirements.txt

# Check if model.pkl exists, if not train the model
if (!(Test-Path "model.pkl")) {
    Write-Host "Model file not found. Training the model..." -ForegroundColor Yellow
    python train_model.py
}

# Start the backend server
Write-Host "Starting backend server on http://127.0.0.1:5000" -ForegroundColor Green
python app.py

Pause