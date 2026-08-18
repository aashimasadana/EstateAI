@echo off
echo ======================================
echo Training House Valuation Machine Learning Model
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

echo Installing/updating required packages...
python -m pip install --upgrade pip
echo Installing Flask...
python -m pip install flask
echo Installing Flask-CORS...
python -m pip install flask-cors
echo Installing NumPy...
python -m pip install numpy
echo Installing Pandas...
python -m pip install pandas
echo Installing scikit-learn...
python -m pip install scikit-learn
echo All required packages installed!
echo.

echo Training the model with dataset...
echo This may take a few moments...
python train_model.py
echo.
echo Model training completed!
pause