import io
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from pathlib import Path

import sys
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
from app.data_processing import validate_dataframe, aggregate_by_slot, clean_dataframe
from app.services.optimization_service import optimize_counters_and_staff

client = TestClient(app)

def test_backend_health():
    """Verify backend health endpoint reports operational status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["dataset_loaded"] is True
    assert data["model_loaded"] is True
    assert data["total_records"] == 100000

def test_all_time_slots_endpoint():
    """Verify time slots endpoint returns all 40 15-minute operating slots."""
    response = client.get("/api/data/time-slots")
    assert response.status_code == 200
    slots = response.json()
    assert len(slots) == 40
    assert slots[0] == "08:00-08:15"
    assert "08:45-09:00" in slots
    assert "10:30-10:45" in slots
    assert "16:15-16:30" in slots
    assert slots[-1] == "17:45-18:00"

def test_data_summary():
    """Verify summary metrics calculation from the 100,000 dataset."""
    response = client.get("/api/data/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 100000
    assert data["total_aggregate_slots"] == 20000
    assert len(data["counter_stats"]) == 5
    assert data["duplicate_rows"] == 0
    assert data["total_historical_orders"] > 600000
    assert len(data["hourly_distribution"]) == 40

def test_data_preview():
    """Verify preview returns requested number of records."""
    response = client.get("/api/data/preview?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["records"]) == 10
    assert "counter_id" in data["columns"]
    assert "orders_served" in data["columns"]

def test_data_aggregation_by_slot():
    """Verify time slot aggregation computes demand as sum of counter orders."""
    sample_data = pd.DataFrame([
        {"date": "2024-01-01", "time_slot": "12:00-12:15", "counter_id": "C1", "orders_served": 20, "queue_length": 2, "avg_wait_min": 1.5, "staff_on_duty": 2, "class_break": "yes", "campus_event": "no"},
        {"date": "2024-01-01", "time_slot": "12:00-12:15", "counter_id": "C2", "orders_served": 15, "queue_length": 1, "avg_wait_min": 1.0, "staff_on_duty": 1, "class_break": "yes", "campus_event": "no"},
        {"date": "2024-01-01", "time_slot": "12:00-12:15", "counter_id": "C3", "orders_served": 5, "queue_length": 0, "avg_wait_min": 0.5, "staff_on_duty": 1, "class_break": "yes", "campus_event": "no"},
        {"date": "2024-01-01", "time_slot": "12:00-12:15", "counter_id": "C4", "orders_served": 0, "queue_length": 0, "avg_wait_min": 0.0, "staff_on_duty": 0, "class_break": "yes", "campus_event": "no"},
        {"date": "2024-01-01", "time_slot": "12:00-12:15", "counter_id": "C5", "orders_served": 0, "queue_length": 0, "avg_wait_min": 0.0, "staff_on_duty": 0, "class_break": "yes", "campus_event": "no"}
    ])
    agg = aggregate_by_slot(sample_data)
    assert len(agg) == 1
    # Sum of orders = 20 + 15 + 5 + 0 + 0 = 40
    assert agg.iloc[0]["demand"] == 40
    assert agg.iloc[0]["total_staff_on_duty"] == 4
    assert agg.iloc[0]["class_break"] == "yes"

def test_invalid_csv_validation():
    """Verify validation flags missing columns and invalid numeric values."""
    # 1. Missing columns
    bad_df = pd.DataFrame({"random_col": [1, 2, 3]})
    val = validate_dataframe(bad_df)
    assert val["is_valid"] is False
    assert any("Missing required columns" in err for err in val["errors"])

    # 2. Upload invalid CSV via endpoint
    csv_bytes = b"wrong_col1,wrong_col2\n1,2\n"
    response = client.post(
        "/api/data/upload",
        files={"file": ("invalid.csv", csv_bytes, "text/csv")}
    )
    assert response.status_code == 422
    assert response.json()["validation"]["is_valid"] is False

def test_prediction_endpoint():
    """Verify demand forecasting produces realistic results."""
    payload = {
        "date": "2025-05-30",
        "time_slot": "12:30-12:45",
        "class_break": "yes",
        "campus_event": "no",
        "horizon_slots": 1
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["slots"]) == 1
    slot = data["slots"][0]
    assert slot["predicted_demand"] > 0
    assert slot["demand_category"] in ["Moderate", "High", "Surge"]
    assert slot["recommended_counters"] >= 2
    assert slot["actual_demand"] is not None  # 2025-05-30 is in dataset

def test_multi_horizon_prediction():
    """Verify roll-forward multi-slot forecasting."""
    payload = {
        "date": "2025-05-30",
        "time_slot": "12:00-12:15",
        "class_break": "yes",
        "campus_event": "no",
        "horizon_slots": 4
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["slots"]) == 4
    slots = [s["time_slot"] for s in data["slots"]]
    assert slots == ["12:00-12:15", "12:15-12:30", "12:30-12:45", "12:45-13:00"]

def test_optimization_normal_demand():
    """Verify counter optimization under balanced load."""
    payload = {
        "predicted_demand": 45.0,
        "available_staff": 8,
        "max_counters": 5,
        "target_wait_min": 3.0,
        "service_rate_per_staff": 15.0
    }
    response = client.post("/api/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_overload"] is False
    assert data["open_counters_count"] >= 2
    assert data["total_staff_allocated"] >= 3
    assert data["estimated_wait_min"] <= 4.0
    # Check counter status
    c1 = next(c for c in data["counters"] if c["counter_id"] == "C1")
    assert c1["status"] == "Open"

def test_optimization_insufficient_staff_scenario():
    """Verify overload alert when high demand exceeds available staff capacity."""
    payload = {
        "predicted_demand": 95.0,  # High lunch surge
        "available_staff": 3,      # Only 3 staff available!
        "max_counters": 5,
        "target_wait_min": 3.0,
        "service_rate_per_staff": 15.0
    }
    response = client.post("/api/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_overload"] is True
    assert data["overload_warning"] is not None
    assert "Staff Shortage" in data["overload_warning"]
    assert any("URGENT" in rec for rec in data["action_recommendations"])

def test_model_metrics():
    """Verify ML model metrics match actual held-out test evaluations."""
    response = client.get("/api/model/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["train_records"] == 16000
    assert data["test_records"] == 4000
    assert data["model_metrics"]["r2"] > 0.70
    assert data["model_metrics"]["mae"] < 10.0
    # Baseline comparison
    assert data["baseline_metrics"]["r2"] < 0.05
    assert len(data["actual_vs_predicted_sample"]) > 0

def test_feature_importance():
    """Verify feature importances are returned from RandomForest."""
    response = client.get("/api/model/feature-importance")
    assert response.status_code == 200
    data = response.json()
    assert len(data["features"]) >= 10
    assert any(f["feature"] == "lag_1_slot" for f in data["features"])

def test_peak_hour_plan_report():
    """Verify peak-hour action plan generation."""
    response = client.post("/api/reports/peak-plan?date=2025-05-30")
    assert response.status_code == 200
    data = response.json()
    assert data["total_peak_slots"] > 0
    assert len(data["items"]) == data["total_peak_slots"]
    item = data["items"][0]
    assert "recommended_open_counters" in item
    assert "action" in item
    assert "expected_outcome" in item

def test_csv_report_exports():
    """Verify CSV export responses."""
    resp1 = client.get("/api/reports/predictions?date=2025-05-30&horizon=5")
    assert resp1.status_code == 200
    assert "text/csv" in resp1.headers["content-type"]
    assert "Predicted Demand" in resp1.text

    resp2 = client.get("/api/reports/counters?demand=60.0")
    assert resp2.status_code == 200
    assert "text/csv" in resp2.headers["content-type"]
    assert "Counter ID" in resp2.text
