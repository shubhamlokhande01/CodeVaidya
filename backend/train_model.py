import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
import joblib

DATA_PATH = Path(__file__).with_name("health_data.csv")

# Load dataset
data = pd.read_csv(DATA_PATH)

# Drop district column
data = data.drop("district", axis=1)

# Convert output labels (Low/Medium/High → numbers)
le = LabelEncoder()
data['risk_level'] = le.fit_transform(data['risk_level'])

# Separate input & output
X = data.drop("risk_level", axis=1)
y = data["risk_level"]

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train model
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# Test model
y_pred = model.predict(X_test)

# Accuracy print
print("Accuracy:", accuracy_score(y_test, y_pred))

# Save model
joblib.dump(model, "model.pkl")
joblib.dump(le, "encoder.pkl")