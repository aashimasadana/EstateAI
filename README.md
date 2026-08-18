# House Valuation System

This is a machine learning-based house price prediction system with a web interface.

## Prerequisites

- Python 3.7 or higher
- pip package manager

## Installation

1. Install Python from [python.org](https://www.python.org/downloads/)
2. Clone or download this repository
3. Navigate to the backend directory: `cd backend`

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Make sure you have the trained model file `model.pkl`. If not, run the training script:
   ```
   python train_model.py
   ```

## Running the Application

1. Start the backend server:
   ```
   python app.py
   ```
   The server will start on `http://127.0.0.1:5000`

2. Open `frontend/index.html` in your web browser

3. Enter house details and click "Predict Price" to get the estimated price

## Troubleshooting

- If you get "ModuleNotFoundError", make sure you installed all requirements with `pip install -r requirements.txt`
- If the frontend shows "Error connecting to backend server", make sure the backend server is running on port 5000
- Check that both frontend and backend are running simultaneously