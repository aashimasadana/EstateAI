@echo off
echo ======================================
echo Installing House Valuation System Dependencies
echo ======================================

cd /d "%~dp0\backend"

echo Checking if Python is available...
python --version >nul 2>&1
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

echo Upgrading pip...
python -m pip install --upgrade pip
echo.

echo Installing Flask...
python -m pip install flask
echo.

echo Installing Flask-CORS...
python -m pip install flask-cors
echo.

echo Installing NumPy...
python -m pip install numpy
echo.

echo Installing Pandas...
python -m pip install pandas
echo.

echo Installing scikit-learn...
python -m pip install scikit-learn
echo.

echo ================================
echo All dependencies installed successfully!
echo ================================
pause