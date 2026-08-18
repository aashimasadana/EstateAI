import requests
import sys
import os

def test_backend_connection():
    try:
        # Test if the backend server is running
        response = requests.get('http://127.0.0.1:5000/')
        print("✓ Backend server is responding!")
        print(f"Response: {response.text}")
        return True
    except requests.exceptions.ConnectionError:
        print("✗ Backend server is not running or not accessible.")
        print("Please run 'run_backend.bat' first.")
        return False
    except Exception as e:
        print(f"✗ Error connecting to backend: {e}")
        return False

def test_prediction():
    try:
        # Test a prediction request
        payload = {
            "sqft": 1000,
            "bath": 2,
            "bhk": 2
        }
        response = requests.post('http://127.0.0.1:5000/predict', json=payload)
        if response.status_code == 200:
            print("✓ Prediction endpoint is working!")
            print(f"Response: {response.json()}")
        else:
            print(f"✗ Prediction endpoint returned error: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"✗ Error testing prediction: {e}")

if __name__ == "__main__":
    print("Testing backend connection...")
    if test_backend_connection():
        test_prediction()
    print("\nIf the backend server is not running, please:")
    print("1. Run 'train_model.bat' to train the model (if not already done)")
    print("2. Run 'run_backend.bat' to start the server")
    print("3. Keep the server window open while using the frontend")