import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..config import DEFAULT_DATA_FILE
from ..data_processing import (
    load_dataset,
    aggregate_by_slot,
    ALL_TIME_SLOTS
)
try:
    from ml.predict import predictor
except ImportError:
    import sys
    from pathlib import Path
    backend_root = Path(__file__).resolve().parent.parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))
    from ml.predict import predictor
from ..schemas import PredictRequest, PredictResponse, SlotPredictionItem

class CanteenDataManager:
    def __init__(self):
        self.raw_df: Optional[pd.DataFrame] = None
        self.agg_df: Optional[pd.DataFrame] = None
        self.dataset_path = DEFAULT_DATA_FILE
        self._load()

    def _load(self):
        if self.dataset_path.exists():
            try:
                self.raw_df = load_dataset(self.dataset_path)
                self.agg_df = aggregate_by_slot(self.raw_df)
            except Exception as e:
                print(f"Warning: Failed to load dataset: {e}")
                self.raw_df = None
                self.agg_df = None

    def reload(self, new_path: Optional[str] = None):
        if new_path:
            from pathlib import Path
            self.dataset_path = Path(new_path)
        self._load()

    def is_loaded(self) -> bool:
        return self.raw_df is not None and len(self.raw_df) > 0

    def get_summary(self) -> Dict[str, Any]:
        if not self.is_loaded():
            raise ValueError("Dataset is not loaded.")

        df = self.raw_df
        agg = self.agg_df

        # Date range
        dates = pd.to_datetime(df["date"])
        min_date = dates.min().strftime("%Y-%m-%d")
        max_date = dates.max().strftime("%Y-%m-%d")
        total_days = int(dates.nunique())

        # Missing values
        missing_dict = {col: int(df[col].isnull().sum()) for col in df.columns}

        # Duplicates
        dups = int(df.duplicated(subset=["date", "time_slot", "counter_id"]).sum())

        # Totals
        total_orders = int(df["orders_served"].sum())
        avg_queue = round(float(df["queue_length"].mean()), 2)
        avg_wait = round(float(df["avg_wait_min"].mean()), 2)

        # Counter stats
        counter_stats = []
        for cid, grp in df.groupby("counter_id"):
            counter_stats.append({
                "counter_id": str(cid),
                "total_orders": int(grp["orders_served"].sum()),
                "avg_orders_per_slot": round(float(grp["orders_served"].mean()), 2),
                "avg_queue_length": round(float(grp["queue_length"].mean()), 2),
                "avg_wait_min": round(float(grp["avg_wait_min"].mean()), 2),
                "max_staff_observed": int(grp["staff_on_duty"].max())
            })
        counter_stats.sort(key=lambda x: x["counter_id"])

        # Hourly distribution from aggregated data
        hourly_dist = []
        for slot, grp in agg.groupby("time_slot"):
            avg_d = float(grp["demand"].mean())
            max_d = float(grp["demand"].max())
            min_d = float(grp["demand"].min())
            
            if avg_d >= 70:
                cat = "Peak Rush"
            elif avg_d >= 45:
                cat = "Moderate High"
            elif avg_d >= 25:
                cat = "Moderate"
            else:
                cat = "Off-Peak"

            hourly_dist.append({
                "time_slot": slot,
                "avg_demand": round(avg_d, 1),
                "max_demand": round(max_d, 1),
                "min_demand": round(min_d, 1),
                "peak_category": cat
            })
        hourly_dist.sort(key=lambda x: x["time_slot"])

        return {
            "total_records": len(df),
            "total_aggregate_slots": len(agg),
            "columns": list(df.columns),
            "date_range": {
                "start": min_date,
                "end": max_date,
                "unique_days": total_days
            },
            "missing_values": missing_dict,
            "duplicate_rows": dups,
            "total_historical_orders": total_orders,
            "avg_queue_length": avg_queue,
            "avg_wait_min": avg_wait,
            "counter_stats": counter_stats,
            "hourly_distribution": hourly_dist,
            "is_sample_dataset": True
        }

    def get_preview(self, limit: int = 10) -> Dict[str, Any]:
        if not self.is_loaded():
            raise ValueError("Dataset is not loaded.")
        records = self.raw_df.head(limit).to_dict(orient="records")
        return {
            "columns": list(self.raw_df.columns),
            "records": records,
            "total_rows": len(self.raw_df)
        }

    def get_historical_demand_lookup(self, date_str: str) -> Dict[str, float]:
        """
        Returns a dict of {time_slot: demand} for the specified date if present in dataset.
        """
        if not self.is_loaded() or self.agg_df is None:
            return {}

        matching = self.agg_df[self.agg_df["date"] == pd.to_datetime(date_str)]
        if matching.empty:
            return {}

        return dict(zip(matching["time_slot"], matching["demand"]))

    def get_historical_counter_stats_for_slot(self, time_slot: str) -> Dict[str, float]:
        """
        Returns average orders served by each counter during the given time slot across historical records.
        """
        if not self.is_loaded():
            return {}
        slot_df = self.raw_df[self.raw_df["time_slot"] == time_slot]
        if slot_df.empty:
            return {}
        return slot_df.groupby("counter_id")["orders_served"].mean().round(1).to_dict()

data_manager = CanteenDataManager()

def predict_canteen_demand(req: PredictRequest) -> PredictResponse:
    hist_lookup = data_manager.get_historical_demand_lookup(req.date)

    slots_data = predictor.predict_horizon(
        date_str=req.date,
        start_time_slot=req.time_slot,
        class_break=req.class_break,
        campus_event=req.campus_event,
        horizon_slots=req.horizon_slots,
        historical_lookup=hist_lookup
    )

    items = [
        SlotPredictionItem(
            time_slot=s["time_slot"],
            predicted_demand=s["predicted_demand"],
            demand_category=s["demand_category"],
            predicted_queue_risk=s["predicted_queue_risk"],
            recommended_counters=s["recommended_counters"],
            actual_demand=s.get("actual_demand"),
            historical_avg=s.get("historical_avg"),
            notes=s["notes"]
        )
        for s in slots_data
    ]

    return PredictResponse(
        date=req.date,
        slots=items,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        model_used="RandomForestRegressor (Trained on Aggregated Slot Demand)"
    )
