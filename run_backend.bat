@echo off
echo ==========================================
echo Starting House Valuation System Backend Server...
echo ==========================================
cd /d "%~dp0\backend"

echo Checking if Python is available...
py --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
echo Python is available.
echo.

echo Installing/updating required packages...
py -m pip install --upgrade pip
echo Installing Flask...
py -m pip install flask
echo Installing Flask-CORS...
py -m pip install flask-cors
echo Installing NumPy...
py -m pip install numpy
echo Installing Pandas...
py -m pip install pandas
echo Installing scikit-learn...
py -m pip install scikit-learn
echo All required packages installed!
echo.

echo Checking for model file...
if not exist "model.pkl" (
    echo Model file not found. Training the model...
    py train_model.py
    echo.
) else (
    echo Model file found.
)

echo Starting backend server on http://127.0.0.1:5000
echo NOTE: Keep this window open while using the frontend
echo.
py app.py

echo.
echo Server stopped.
pause