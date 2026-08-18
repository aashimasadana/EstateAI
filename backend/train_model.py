import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score, mean_absolute_error
import pickle
import json

df = pd.read_csv("../dataset/house_data.csv")

# Encode city, state, category
le_city = LabelEncoder()
le_state = LabelEncoder()
le_cat = LabelEncoder()

df['city_encoded']     = le_city.fit_transform(df['city'])
df['state_encoded']    = le_state.fit_transform(df['state'])
df['category_encoded'] = le_cat.fit_transform(df['category'])

X = df[['sqft', 'bath', 'bhk', 'city_encoded', 'state_encoded', 'category_encoded']]
y = df['price']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingRegressor(n_estimators=300, learning_rate=0.08, max_depth=4, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

print(f"R² Score : {r2:.4f}")
print(f"MAE      : ₹{mae:,.0f}")

with open("model.pkl",       "wb") as f: pickle.dump(model,    f)
with open("le_city.pkl",     "wb") as f: pickle.dump(le_city,  f)
with open("le_state.pkl",    "wb") as f: pickle.dump(le_state, f)
with open("le_cat.pkl",      "wb") as f: pickle.dump(le_cat,   f)

# Build city→state and category→cities lookup for frontend dropdowns
city_state_map = df[['city','state','category']].drop_duplicates().sort_values('city')
locations = {}
for _, row in city_state_map.iterrows():
    cat = row['category']
    if cat not in locations:
        locations[cat] = []
    entry = {"city": row['city'], "state": row['state']}
    if entry not in locations[cat]:
        locations[cat].append(entry)

meta = {
    "r2_score"  : round(r2, 4),
    "mae"       : round(mae, 2),
    "locations" : locations,           # {category: [{city, state}]}
    "categories": sorted(locations.keys()),
    "sqft_min"  : int(df['sqft'].min()),
    "sqft_max"  : int(df['sqft'].max()),
}
with open("model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)

print("All files saved.")
print("Categories:", list(locations.keys()))
for cat, cities in locations.items():
    print(f"  {cat}: {[c['city'] for c in cities]}")
