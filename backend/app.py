from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os
import pandas as pd
import json

app = Flask(__name__)
CORS(app)

BASE_DIR     = os.path.dirname(__file__)
DATASET_PATH = os.path.join(BASE_DIR, '..', 'dataset', 'house_data.csv')

model      = None
le_city    = None
le_state   = None
le_cat     = None
model_meta = {}

def load_artifacts():
    global model, le_city, le_state, le_cat, model_meta
    try:
        with open(os.path.join(BASE_DIR, "model.pkl"),       "rb") as f: model    = pickle.load(f)
        with open(os.path.join(BASE_DIR, "le_city.pkl"),     "rb") as f: le_city  = pickle.load(f)
        with open(os.path.join(BASE_DIR, "le_state.pkl"),    "rb") as f: le_state = pickle.load(f)
        with open(os.path.join(BASE_DIR, "le_cat.pkl"),      "rb") as f: le_cat   = pickle.load(f)
        with open(os.path.join(BASE_DIR, "model_meta.json"), "r")  as f: model_meta = json.load(f)
        print("All artifacts loaded successfully.")
    except FileNotFoundError as e:
        print(f"Warning: {e}. Run train_model.py first.")
    except Exception as e:
        print(f"Error loading artifacts: {e}")

load_artifacts()


@app.route("/")
def home():
    return jsonify({"status": "running", "message": "EstateAI Backend"})


@app.route("/api/meta", methods=["GET"])
def get_meta():
    if not model_meta:
        return jsonify({"error": "Model not trained yet"}), 503
    return jsonify(model_meta)


@app.route("/api/data", methods=["GET"])
def get_data():
    try:
        category_filter = request.args.get("category", None)
        city_filter     = request.args.get("city",     None)
        state_filter    = request.args.get("state",    None)

        if not os.path.exists(DATASET_PATH):
            return jsonify({"error": "Dataset not found"}), 404

        df = pd.read_csv(DATASET_PATH)

        if category_filter and category_filter != "All":
            df = df[df['category'] == category_filter]
        if city_filter and city_filter != "All":
            df = df[df['city'] == city_filter]
        if state_filter and state_filter != "All":
            df = df[df['state'] == state_filter]

        if df.empty:
            return jsonify({"error": "No data for selected filters"}), 404

        stats = {
            "avg_price"    : round(df['price'].mean(), 2),
            "avg_area"     : round(df['sqft'].mean(), 2),
            "common_bhk"   : int(df['bhk'].mode()[0]),
            "total_records": len(df),
            "r2_score"     : model_meta.get("r2_score", "N/A"),
            "mae"          : model_meta.get("mae", "N/A"),
        }

        chart_data = {
            "sqft"    : df['sqft'].tolist(),
            "bath"    : df['bath'].tolist(),
            "bhk"     : df['bhk'].tolist(),
            "price"   : df['price'].tolist(),
            "city"    : df['city'].tolist(),
            "state"   : df['state'].tolist(),
            "category": df['category'].tolist(),
        }

        return jsonify({"stats": stats, "data": chart_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── NEW: Market efficiency endpoint ─────────────────────────────────────────
@app.route("/api/efficiency", methods=["GET"])
def get_efficiency():
    """Return avg price-per-sqft for a city/category so frontend can score predictions."""
    try:
        city_filter     = request.args.get("city",     None)
        category_filter = request.args.get("category", None)

        if not os.path.exists(DATASET_PATH):
            return jsonify({"error": "Dataset not found"}), 404

        df = pd.read_csv(DATASET_PATH)
        df['price_per_sqft'] = df['price'] / df['sqft']

        # Market average for city+category
        subset = df.copy()
        if city_filter     and city_filter     != "All": subset = subset[subset['city']     == city_filter]
        if category_filter and category_filter != "All": subset = subset[subset['category'] == category_filter]

        if subset.empty:
            return jsonify({"error": "No data"}), 404

        mkt_avg  = round(subset['price_per_sqft'].mean(), 2)
        mkt_p25  = round(subset['price_per_sqft'].quantile(0.25), 2)
        mkt_p75  = round(subset['price_per_sqft'].quantile(0.75), 2)

        return jsonify({
            "market_avg_per_sqft": mkt_avg,
            "p25_per_sqft"       : mkt_p25,
            "p75_per_sqft"       : mkt_p75,
            "sample_size"        : len(subset),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── NEW: Bulk compare endpoint ───────────────────────────────────────────────
@app.route("/compare", methods=["POST"])
def compare():
    """Accept two property specs and return predictions for both."""
    global model, le_city, le_state, le_cat

    if model is None:
        load_artifacts()
        if model is None:
            return jsonify({"error": "Model not loaded. Run train_model.py first."}), 503

    try:
        data = request.get_json()
        results = []
        for idx, prop in enumerate(data.get("properties", [])):
            required = ["sqft", "bath", "bhk", "city", "state", "category"]
            missing  = [k for k in required if k not in prop]
            if missing:
                return jsonify({"error": f"Property {idx+1} missing: {', '.join(missing)}"}), 400

            sqft     = float(prop["sqft"])
            bath     = float(prop["bath"])
            bhk      = float(prop["bhk"])
            city     = str(prop["city"])
            state    = str(prop["state"])
            category = str(prop["category"])

            known_cities = list(le_city.classes_)
            known_states = list(le_state.classes_)
            known_cats   = list(le_cat.classes_)

            if city     not in known_cities: return jsonify({"error": f"Unknown city '{city}'"}), 400
            if state    not in known_states: return jsonify({"error": f"Unknown state '{state}'"}), 400
            if category not in known_cats:   return jsonify({"error": f"Unknown category '{category}'"}), 400

            city_enc  = le_city.transform([city])[0]
            state_enc = le_state.transform([state])[0]
            cat_enc   = le_cat.transform([category])[0]

            features   = np.array([[sqft, bath, bhk, city_enc, state_enc, cat_enc]])
            prediction = model.predict(features)
            price      = round(max(float(prediction[0]), 0), 2)

            results.append({
                "price"         : price,
                "price_low"     : round(price * 0.90, 2),
                "price_high"    : round(price * 1.10, 2),
                "price_per_sqft": round(price / sqft, 2),
                "city"          : city,
                "state"         : state,
                "category"      : category,
                "sqft"          : sqft,
                "bath"          : bath,
                "bhk"           : bhk,
            })

        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route("/predict", methods=["POST"])
def predict():
    global model, le_city, le_state, le_cat

    if model is None:
        load_artifacts()
        if model is None:
            return jsonify({"error": "Model not loaded. Run train_model.py first."}), 503

    try:
        data     = request.get_json()
        required = ["sqft", "bath", "bhk", "city", "state", "category"]
        missing  = [k for k in required if k not in data]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        sqft     = float(data["sqft"])
        bath     = float(data["bath"])
        bhk      = float(data["bhk"])
        city     = str(data["city"])
        state    = str(data["state"])
        category = str(data["category"])

        if sqft <= 0 or bath <= 0 or bhk <= 0:
            return jsonify({"error": "sqft, bath, and bhk must be positive"}), 400
        if sqft > 20000:
            return jsonify({"error": "sqft seems unrealistically large (max 20,000)"}), 400
        if bath > 20 or bhk > 20:
            return jsonify({"error": "bath/bhk value seems unrealistically large"}), 400

        known_cities = list(le_city.classes_)
        known_states = list(le_state.classes_)
        known_cats   = list(le_cat.classes_)

        if city     not in known_cities: return jsonify({"error": f"Unknown city '{city}'. Valid: {known_cities}"}), 400
        if state    not in known_states: return jsonify({"error": f"Unknown state '{state}'. Valid: {known_states}"}), 400
        if category not in known_cats:   return jsonify({"error": f"Unknown category '{category}'. Valid: {known_cats}"}), 400

        city_enc  = le_city.transform([city])[0]
        state_enc = le_state.transform([state])[0]
        cat_enc   = le_cat.transform([category])[0]

        features   = np.array([[sqft, bath, bhk, city_enc, state_enc, cat_enc]])
        prediction = model.predict(features)

        price      = round(max(float(prediction[0]), 0), 2)
        price_low  = round(price * 0.90, 2)
        price_high = round(price * 1.10, 2)

        return jsonify({
            "price"         : price,
            "price_low"     : price_low,
            "price_high"    : price_high,
            "price_per_sqft": round(price / sqft, 2),
            "city"          : city,
            "state"         : state,
            "category"      : category,
        })

    except ValueError as ve:
        return jsonify({"error": f"Invalid input: {str(ve)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
