import re
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
from .config import (
    DEFAULT_DATA_FILE,
    REQUIRED_COLUMNS,
    ALL_TIME_SLOTS
)

def validate_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validates the canteen dataset columns, types, nulls, and value ranges.
    Returns validation status, errors, and warnings.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # Check required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        errors.append(f"Missing required columns: {', '.join(missing_cols)}")
        return {
            "is_valid": False,
            "errors": errors,
            "warnings": warnings,
            "row_count": len(df),
            "detected_columns": list(df.columns)
        }

    # Check nulls
    null_counts = df[REQUIRED_COLUMNS].isnull().sum().to_dict()
    has_nulls = any(cnt > 0 for cnt in null_counts.values())
    if has_nulls:
        for col, cnt in null_counts.items():
            if cnt > 0:
                errors.append(f"Column '{col}' has {cnt} missing/null values.")

    # Validate date format (YYYY-MM-DD)
    date_sample = df["date"].astype(str).head(100)
    date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    invalid_dates = [d for d in date_sample if not date_regex.match(d)]
    if invalid_dates:
        errors.append(f"Invalid date format detected in sample: {invalid_dates[:3]}. Expected YYYY-MM-DD.")

    # Validate time_slot format
    time_regex = re.compile(r"^\d{2}:\d{2}-\d{2}:\d{2}$")
    time_sample = df["time_slot"].astype(str).head(100)
    invalid_times = [t for t in time_sample if not time_regex.match(t)]
    if invalid_times:
        errors.append(f"Invalid time_slot format detected in sample: {invalid_times[:3]}. Expected HH:MM-HH:MM.")

    # Validate numeric non-negative columns
    for num_col in ["orders_served", "queue_length", "avg_wait_min", "staff_on_duty"]:
        if not pd.api.types.is_numeric_dtype(df[num_col]):
            try:
                pd.to_numeric(df[num_col])
            except Exception:
                errors.append(f"Column '{num_col}' contains non-numeric values.")
        else:
            if (df[num_col] < 0).any():
                errors.append(f"Column '{num_col}' contains negative values.")

    # Validate yes/no fields
    for cat_col in ["class_break", "campus_event"]:
        unique_vals = set(df[cat_col].astype(str).str.lower().str.strip().unique())
        invalid_cat = unique_vals - {"yes", "no"}
        if invalid_cat:
            warnings.append(f"Column '{cat_col}' contains unexpected values: {invalid_cat}. Expected 'yes' or 'no'.")

    # Check duplicates
    dup_count = int(df.duplicated(subset=["date", "time_slot", "counter_id"]).sum())
    if dup_count > 0:
        warnings.append(f"Found {dup_count} duplicate records for the same (date, time_slot, counter_id).")

    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "detected_columns": list(df.columns)
    }

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans string whitespace, standardizes yes/no, converts numeric types.
    """
    df = df.copy()
    for col in ["date", "time_slot", "counter_id"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    for col in ["orders_served", "queue_length", "staff_on_duty"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    if "avg_wait_min" in df.columns:
        df["avg_wait_min"] = pd.to_numeric(df["avg_wait_min"], errors="coerce").fillna(0.0).astype(float)

    for col in ["class_break", "campus_event"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.lower()
            df[col] = df[col].apply(lambda x: "yes" if x == "yes" else "no")

    return df

def load_dataset(filepath: Path = DEFAULT_DATA_FILE) -> pd.DataFrame:
    """
    Loads raw CSV dataset from path and performs initial cleaning.
    Raises FileNotFoundError if file is missing.
    """
    if not filepath.exists():
        raise FileNotFoundError(
            f"Dataset file not found at: {filepath}. Please upload a dataset or provide synthetic_canteen_data.csv."
        )

    df = pd.read_csv(filepath)
    val = validate_dataframe(df)
    if not val["is_valid"]:
        raise ValueError(f"Dataset validation failed: {'; '.join(val['errors'])}")

    df = clean_dataframe(df)
    return df

def aggregate_by_slot(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregates per-counter records into 15-minute slot records.
    Calculates total orders served as demand proxy, total queue length,
    mean wait time, total staff on duty, and active counter count.
    """
    agg = df.groupby(["date", "time_slot"]).agg({
        "orders_served": "sum",
        "queue_length": "sum",
        "avg_wait_min": "mean",
        "staff_on_duty": "sum",
        "class_break": lambda x: "yes" if (x == "yes").any() else "no",
        "campus_event": lambda x: "yes" if (x == "yes").any() else "no",
        "counter_id": lambda x: len([c for c, staff in zip(x, df.loc[x.index, "staff_on_duty"]) if staff > 0])
    }).reset_index()

    agg = agg.rename(columns={
        "orders_served": "demand",
        "queue_length": "total_queue_length",
        "staff_on_duty": "total_staff_on_duty",
        "counter_id": "active_counters"
    })

    agg["date"] = pd.to_datetime(agg["date"])
    agg = agg.sort_values(["date", "time_slot"]).reset_index(drop=True)
    return agg

def compute_slot_index(time_slot: str) -> Tuple[int, int, int]:
    """
    Calculates (hour, minute, slot_index 0..39) from 'HH:MM-HH:MM'.
    """
    start_time = time_slot.split("-")[0]
    h, m = map(int, start_time.split(":"))
    slot_idx = (h - 8) * 4 + (m // 15)
    return h, m, slot_idx

def engineer_features(
    agg_df: pd.DataFrame,
    slot_means: Optional[Dict[int, float]] = None
) -> Tuple[pd.DataFrame, Dict[int, float]]:
    """
    Extracts chronological ML features from aggregated slot DataFrame.
    Strictly avoids data leakage:
      - Uses chronological shift for lag_1_slot and lag_2_slots.
      - Uses previous recorded day's demand for lag_prev_day.
      - Missing lags (first slots or first day) are filled using slot historical means.
    """
    df = agg_df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    time_parsed = [compute_slot_index(ts) for ts in df["time_slot"]]
    df["hour"] = [p[0] for p in time_parsed]
    df["minute"] = [p[1] for p in time_parsed]
    df["slot_index"] = [p[2] for p in time_parsed]

    df["day_of_week"] = df["date"].dt.day_of_week
    df["month"] = df["date"].dt.month

    # Lunch peak: 12:15 to 13:45
    df["is_lunch_peak"] = (
        (df["hour"] == 12) | ((df["hour"] == 13) & (df["minute"] <= 45))
    ).astype(int)

    # Morning break: 10:15 to 11:15
    df["is_morning_break"] = (
        ((df["hour"] == 10) & (df["minute"] >= 15)) |
        ((df["hour"] == 11) & (df["minute"] <= 15))
    ).astype(int)

    # Afternoon break: 15:15 to 15:45
    df["is_afternoon_break"] = (
        (df["hour"] == 15) & (df["minute"] >= 15) & (df["minute"] <= 45)
    ).astype(int)

    df["class_break_num"] = (df["class_break"] == "yes").astype(int)
    df["campus_event_num"] = (df["campus_event"] == "yes").astype(int)

    # Calculate slot historical means if not provided
    if slot_means is None:
        slot_means = df.groupby("slot_index")["demand"].mean().to_dict()

    # Chronological lag features within day
    df["lag_1_slot"] = df.groupby("date")["demand"].shift(1)
    df["lag_2_slots"] = df.groupby("date")["demand"].shift(2)

    df["lag_1_slot"] = df["lag_1_slot"].fillna(df["slot_index"].map(slot_means))
    df["lag_2_slots"] = df["lag_2_slots"].fillna(df["slot_index"].map(slot_means))

    # Previous day same-slot lag
    unique_dates = sorted(df["date"].unique())
    date_to_idx = {d: i for i, d in enumerate(unique_dates)}
    df["date_idx"] = df["date"].map(date_to_idx)

    pivot = df.set_index(["date_idx", "slot_index"])["demand"].unstack()
    prev_day = pivot.shift(1).stack().reset_index()
    prev_day.columns = ["date_idx", "slot_index", "lag_prev_day"]

    df = pd.merge(df, prev_day, on=["date_idx", "slot_index"], how="left")
    df["lag_prev_day"] = df["lag_prev_day"].fillna(df["slot_index"].map(slot_means))

    return df, slot_means

FEATURE_COLUMNS = [
    "hour",
    "minute",
    "slot_index",
    "day_of_week",
    "month",
    "class_break_num",
    "campus_event_num",
    "is_lunch_peak",
    "is_morning_break",
    "is_afternoon_break",
    "lag_1_slot",
    "lag_2_slots",
    "lag_prev_day"
]
