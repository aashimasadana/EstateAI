# 🏠 EstateAI

**EstateAI** is an AI-powered real estate application designed to assist users with property-related predictions and insights. The project combines a machine learning model with a web-based frontend and Python backend to provide an interactive real estate experience.

---

## ✨ Features

* 🏡 Real-estate property prediction
* 🤖 Machine learning-based prediction model
* 🌐 Interactive web interface
* ⚡ Python backend for processing requests
* 📊 Dataset-based model training
* 🔄 Model training and prediction scripts
* 🧩 Separate frontend and backend architecture
* 🧪 Backend testing support

---

## 🛠️ Technologies Used

### Frontend

* HTML5
* CSS3
* JavaScript

### Backend

* Python
* Python-based API/backend architecture

### Machine Learning

* Trained machine learning model
* Dataset-based prediction
* Serialized model and label encoders

### Development Tools

* Git
* GitHub
* PowerShell / Batch scripts

---

## 📁 Project Structure

```text
EstateAI_Enhanced/
│
├── backend/
│   ├── app.py
│   ├── model.pkl
│   ├── model_meta.json
│   ├── label_encoder.pkl
│   ├── le_cat.pkl
│   ├── le_city.pkl
│   ├── le_state.pkl
│   ├── train_model.py
│   └── requirements.txt
│
├── dataset/
│   └── house_data.csv
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── install_dependencies.bat
├── run_backend.bat
├── run_backend.ps1
├── train_model.bat
├── train_model.ps1
├── test_backend.py
├── START_HERE.txt
├── SETUP_INSTRUCTIONS.txt
├── README.md
└── .gitignore
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/aashimasadana/EstateAI.git
```

Move into the project directory:

```bash
cd EstateAI
```

---

## 🐍 Backend Setup

Make sure Python is installed on your system.

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
venv\Scripts\activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

---

## ▶️ Running the Backend

From the project directory, you can use the provided startup script:

```powershell
.\run_backend.ps1
```

Alternatively, use:

```text
run_backend.bat
```

The backend provides the functionality required by the frontend to communicate with the prediction system.

---

## 🌐 Running the Frontend

Open:

```text
frontend/index.html
```

in a web browser, or use the development workflow described in `START_HERE.txt` and `SETUP_INSTRUCTIONS.txt`.

---

## 🤖 Machine Learning Model

EstateAI uses a trained machine learning model to generate property-related predictions based on the available dataset and input features.

The trained model and supporting encoders are stored in the `backend` directory:

```text
model.pkl
label_encoder.pkl
le_cat.pkl
le_city.pkl
le_state.pkl
model_meta.json
```

The model can also be retrained using the provided training scripts.

### Train the model

From the project directory:

```text
train_model.bat
```

or:

```powershell
.\train_model.ps1
```

The underlying training code is available at:

```text
backend/train_model.py
```

---

## 📊 Dataset

The project includes a house-property dataset located at:

```text
dataset/house_data.csv
```

The dataset is used to train the machine learning model and generate property predictions.

---

## 🧪 Testing

The project includes backend testing support:

```text
test_backend.py
```

Run it with:

```bash
python test_backend.py
```

---

## 🔒 Security

Sensitive files such as environment variables and local development files should not be committed to the repository.

The project includes a `.gitignore` file to prevent common development and secret files from being uploaded.

**Never commit API keys, passwords, database credentials, or other private credentials to GitHub.**

---

## 📌 Project Goals

The main goals of EstateAI are to:

1. Apply artificial intelligence to the real estate domain.
2. Provide useful property-related predictions.
3. Create an easy-to-use web interface.
4. Connect a machine learning model with a backend service.
5. Demonstrate an end-to-end AI application.

---

## 🔮 Future Improvements

Possible future enhancements include:

* 📍 Location-based property recommendations
* 🗺️ Interactive property maps
* 📈 Property price trend visualization
* 🏘️ Personalized property recommendations
* 📊 Advanced market analytics
* 🔐 User authentication
* ☁️ Cloud deployment
* 📱 Mobile-responsive improvements
* 🔄 Automated model retraining
* 📦 Larger and more diverse real-estate datasets

---

## 👩‍💻 Author

**Aashima Ssadana**

GitHub:
https://github.com/aashimasadana

---

## ⭐ Contributing

Contributions, suggestions, and improvements are welcome.

If you would like to contribute:

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Commit your changes.
5. Open a pull request.

---

## 📄 License

This project currently does not specify a license.

If this project is intended for public use or collaboration, consider adding an appropriate open-source license.
