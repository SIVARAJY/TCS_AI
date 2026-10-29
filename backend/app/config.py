import os
from pathlib import Path
from typing import List

# Paths
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

DATA_DIR = PROJECT_ROOT / "data"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DATA_FILE = DATA_DIR / "synthetic_canteen_data.csv"
MODEL_FILE = OUTPUTS_DIR / "rf_demand_model.joblib"
BASELINE_MODEL_FILE = OUTPUTS_DIR / "baseline_model.joblib"
METRICS_FILE = OUTPUTS_DIR / "model_metrics.json"
FEATURE_IMPORTANCE_FILE = OUTPUTS_DIR / "feature_importance.json"
TEST_SAMPLE_FILE = OUTPUTS_DIR / "test_predictions_sample.json"
SLOT_MEANS_FILE = OUTPUTS_DIR / "slot_historical_means.json"

# Operational Defaults
DEFAULT_MAX_COUNTERS = 5
DEFAULT_AVAILABLE_STAFF = 8
DEFAULT_SERVICE_RATE_PER_STAFF = 15.0  # orders per staff per 15-minute slot (~1 order/min)
DEFAULT_MAX_COUNTER_CAPACITY = 36.0    # orders per counter per 15-minute slot (2 staff)
DEFAULT_TARGET_WAIT_MIN = 3.0          # minutes

# Server Defaults
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

REQUIRED_COLUMNS = [
    "date",
    "time_slot",
    "counter_id",
    "orders_served",
    "queue_length",
    "avg_wait_min",
    "staff_on_duty",
    "class_break",
    "campus_event"
]

ALL_TIME_SLOTS = [
    f"{h:02d}:{m:02d}-{(h + ((m + 15) // 60)):02d}:{(m + 15) % 60:02d}"
    for h in range(8, 18)
    for m in (0, 15, 30, 45)
]
