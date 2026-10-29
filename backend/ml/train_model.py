import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import sys
# Add parent dir to path so we can import from app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import (
    DEFAULT_DATA_FILE,
    MODEL_FILE,
    BASELINE_MODEL_FILE,
    METRICS_FILE,
    FEATURE_IMPORTANCE_FILE,
    TEST_SAMPLE_FILE,
    SLOT_MEANS_FILE,
    OUTPUTS_DIR
)
from app.data_processing import (
    load_dataset,
    aggregate_by_slot,
    engineer_features,
    FEATURE_COLUMNS
)

def train_and_evaluate():
    print(f"Loading dataset from: {DEFAULT_DATA_FILE}")
    raw_df = load_dataset(DEFAULT_DATA_FILE)
    print(f"Raw records loaded: {len(raw_df)}")

    # Aggregate by date & time slot
    agg_df = aggregate_by_slot(raw_df)
    print(f"Aggregated 15-minute slot records: {len(agg_df)}")

    # Chronological Split (80% train dates, 20% test dates)
    unique_dates = sorted(agg_df["date"].unique())
    split_idx = int(len(unique_dates) * 0.8)
    train_dates = unique_dates[:split_idx]
    test_dates = unique_dates[split_idx:]

    train_mask = agg_df["date"].isin(train_dates)
    test_mask = agg_df["date"].isin(test_dates)

    # Calculate slot means strictly on train set to prevent data leakage
    slot_train_means = agg_df[train_mask].groupby(
        agg_df[train_mask]["time_slot"].apply(lambda ts: (int(ts.split("-")[0].split(":")[0]) - 8) * 4 + (int(ts.split("-")[0].split(":")[1]) // 15))
    )["demand"].mean().to_dict()

    # Engineer features
    feat_df, _ = engineer_features(agg_df, slot_means=slot_train_means)

    X_train = feat_df.loc[train_mask, FEATURE_COLUMNS]
    y_train = feat_df.loc[train_mask, "demand"]
    X_test = feat_df.loc[test_mask, FEATURE_COLUMNS]
    y_test = feat_df.loc[test_mask, "demand"]

    train_count = len(X_train)
    test_count = len(X_test)
    print(f"Chronological split -> Train records: {train_count}, Test records: {test_count}")
    print(f"Train date range: {train_dates[0].strftime('%Y-%m-%d')} to {train_dates[-1].strftime('%Y-%m-%d')}")
    print(f"Test date range: {test_dates[0].strftime('%Y-%m-%d')} to {test_dates[-1].strftime('%Y-%m-%d')}")

    # 1. Baseline Model (Mean)
    print("Training DummyRegressor (Baseline)...")
    baseline = DummyRegressor(strategy="mean")
    baseline.fit(X_train, y_train)
    y_pred_base = baseline.predict(X_test)

    # 2. Primary Model: RandomForestRegressor
    print("Training RandomForestRegressor (Primary Model)...")
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)

    # 3. Benchmark: HistGradientBoostingRegressor
    print("Training HistGradientBoostingRegressor (Benchmark)...")
    hgb = HistGradientBoostingRegressor(max_iter=100, random_state=42)
    hgb.fit(X_train, y_train)
    y_pred_hgb = hgb.predict(X_test)

    # Metrics calculation
    def calc_metrics(y_true, y_pred):
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        r2 = float(r2_score(y_true, y_pred))
        return {"mae": round(mae, 3), "rmse": round(rmse, 3), "r2": round(r2, 3)}

    base_metrics = calc_metrics(y_test, y_pred_base)
    rf_metrics = calc_metrics(y_test, y_pred_rf)
    hgb_metrics = calc_metrics(y_test, y_pred_hgb)

    print("\n--- Model Evaluation on Held-Out Test Set ---")
    print(f"Baseline (Mean):                MAE={base_metrics['mae']}, RMSE={base_metrics['rmse']}, R2={base_metrics['r2']}")
    print(f"RandomForestRegressor:          MAE={rf_metrics['mae']}, RMSE={rf_metrics['rmse']}, R2={rf_metrics['r2']}")
    print(f"HistGradientBoostingRegressor:  MAE={hgb_metrics['mae']}, RMSE={hgb_metrics['rmse']}, R2={hgb_metrics['r2']}")

    # Save models
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf, MODEL_FILE)
    joblib.dump(baseline, BASELINE_MODEL_FILE)
    print(f"Saved primary model to: {MODEL_FILE}")

    # Save slot historical means (as string keys for JSON compatibility)
    with open(SLOT_MEANS_FILE, "w", encoding="utf-8") as f:
        json.dump({str(k): round(float(v), 2) for k, v in slot_train_means.items()}, f, indent=2)

    # Feature Importance
    feature_descriptions = {
        "hour": "Time of day (Hour 8-17)",
        "minute": "Quarter hour within slot (0, 15, 30, 45)",
        "slot_index": "Sequential index of 15-minute slot (0-39)",
        "day_of_week": "Day of the week (0=Mon to 4=Fri)",
        "month": "Calendar month (1-12)",
        "class_break_num": "Active class break surge indicator",
        "campus_event_num": "Campus special event footfall indicator",
        "is_lunch_peak": "Core canteen lunch rush period (12:15-13:45)",
        "is_morning_break": "Morning snack & coffee break (10:15-11:15)",
        "is_afternoon_break": "Afternoon snack break (15:15-15:45)",
        "lag_1_slot": "Immediately preceding 15-minute slot demand",
        "lag_2_slots": "Demand two slots prior (30-minute lag)",
        "lag_prev_day": "Demand at the exact same slot on previous day"
    }

    importances = [
        {
            "feature": feat,
            "importance": round(float(imp), 4),
            "description": feature_descriptions.get(feat, feat)
        }
        for feat, imp in sorted(zip(FEATURE_COLUMNS, rf.feature_importances_), key=lambda x: x[1], reverse=True)
    ]

    with open(FEATURE_IMPORTANCE_FILE, "w", encoding="utf-8") as f:
        json.dump({"model_name": "RandomForestRegressor", "features": importances}, f, indent=2)

    # Test Sample Comparison (50 held-out records)
    test_df = feat_df.loc[test_mask].copy().reset_index(drop=True)
    test_df["predicted"] = np.round(y_pred_rf, 1)
    test_df["residual"] = np.round(test_df["demand"] - test_df["predicted"], 1)

    # Select representative sample from test set
    sample_records = []
    # Pick 50 evenly spaced slots
    sample_indices = np.linspace(0, len(test_df) - 1, 50, dtype=int)
    for idx in sample_indices:
        row = test_df.iloc[idx]
        sample_records.append({
            "date": row["date"].strftime("%Y-%m-%d"),
            "time_slot": row["time_slot"],
            "actual_demand": int(row["demand"]),
            "predicted_demand": float(row["predicted"]),
            "residual": float(row["residual"]),
            "class_break": row["class_break"],
            "campus_event": row["campus_event"]
        })

    with open(TEST_SAMPLE_FILE, "w", encoding="utf-8") as f:
        json.dump(sample_records, f, indent=2)

    # Save full metrics JSON
    metrics_data = {
        "model_name": "RandomForestRegressor",
        "baseline_name": "DummyRegressor (Historical Mean)",
        "train_records": train_count,
        "test_records": test_count,
        "split_type": "Chronological (First 80% train dates, Last 20% test dates)",
        "train_date_range": {
            "start": train_dates[0].strftime("%Y-%m-%d"),
            "end": train_dates[-1].strftime("%Y-%m-%d")
        },
        "test_date_range": {
            "start": test_dates[0].strftime("%Y-%m-%d"),
            "end": test_dates[-1].strftime("%Y-%m-%d")
        },
        "baseline_metrics": base_metrics,
        "model_metrics": rf_metrics,
        "gradient_boosting_metrics": hgb_metrics,
        "feature_count": len(FEATURE_COLUMNS),
        "explanation": (
            "Because canteen demand forecasting is a continuous quantity regression task, standard classification "
            "accuracy percentages are not mathematically meaningful. Instead, model performance is evaluated using "
            "Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and the Coefficient of Determination (R²). "
            f"The trained RandomForestRegressor achieves an R² of {rf_metrics['r2']} and an MAE of {rf_metrics['mae']} orders per slot, "
            f"vastly outperforming the naive baseline (R²={base_metrics['r2']}, MAE={base_metrics['mae']} orders)."
        )
    }

    with open(METRICS_FILE, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)

    print(f"Metrics saved to: {METRICS_FILE}")
    print("Training complete successfully!")
    return metrics_data

if __name__ == "__main__":
    train_and_evaluate()
