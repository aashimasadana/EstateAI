Write-Host "Training House Valuation Model..." -ForegroundColor Green

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

# Train the model
Write-Host "Training the model with dataset..." -ForegroundColor Cyan
python train_model.py

Pause