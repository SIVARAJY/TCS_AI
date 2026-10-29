import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import sys
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import (
    MODEL_FILE,
    SLOT_MEANS_FILE,
    ALL_TIME_SLOTS
)
from app.data_processing import compute_slot_index, FEATURE_COLUMNS

class DemandPredictor:
    def __init__(self):
        self.model = None
        self.slot_means: Dict[int, float] = {}
        self._load_artifacts()

    def _load_artifacts(self):
        if MODEL_FILE.exists():
            self.model = joblib.load(MODEL_FILE)
        if SLOT_MEANS_FILE.exists():
            with open(SLOT_MEANS_FILE, "r", encoding="utf-8") as f:
                raw_means = json.load(f)
                self.slot_means = {int(k): float(v) for k, v in raw_means.items()}

    def is_ready(self) -> bool:
        return self.model is not None and len(self.slot_means) > 0

    def categorize_demand(self, demand: float) -> Tuple[str, str, int]:
        """
        Returns (demand_category, queue_risk, recommended_counters).
        """
        if demand <= 25:
            return "Low", "Low", 1
        elif demand <= 50:
            return "Moderate", "Moderate", 2
        elif demand <= 75:
            return "High", "High", 3
        else:
            return "Surge", "Critical", min(5, max(4, int(np.ceil(demand / 25.0))))

    def predict_slot(
        self,
        date_str: str,
        time_slot: str,
        class_break: str = "no",
        campus_event: str = "no",
        lag_1: Optional[float] = None,
        lag_2: Optional[float] = None,
        lag_prev_day: Optional[float] = None
    ) -> float:
        """
        Predicts total demand for a single 15-minute slot.
        """
        if not self.is_ready():
            self._load_artifacts()
            if not self.is_ready():
                raise RuntimeError("Prediction model is not trained or loaded.")

        dt = pd.to_datetime(date_str)
        h, m, slot_idx = compute_slot_index(time_slot)
        day_of_week = dt.day_of_week
        month = dt.month

        is_lunch = 1 if ((h == 12) or (h == 13 and m <= 45)) else 0
        is_morn = 1 if ((h == 10 and m >= 15) or (h == 11 and m <= 15)) else 0
        is_aftn = 1 if (h == 15 and 15 <= m <= 45) else 0

        c_break = 1 if class_break.lower() == "yes" else 0
        c_event = 1 if campus_event.lower() == "yes" else 0

        # Lags fallback to slot historical mean
        mean_val = self.slot_means.get(slot_idx, 30.0)
        l1 = lag_1 if lag_1 is not None else mean_val
        l2 = lag_2 if lag_2 is not None else self.slot_means.get(max(0, slot_idx - 1), mean_val)
        lpd = lag_prev_day if lag_prev_day is not None else mean_val

        feature_dict = {
            "hour": [h],
            "minute": [m],
            "slot_index": [slot_idx],
            "day_of_week": [day_of_week],
            "month": [month],
            "class_break_num": [c_break],
            "campus_event_num": [c_event],
            "is_lunch_peak": [is_lunch],
            "is_morning_break": [is_morn],
            "is_afternoon_break": [is_aftn],
            "lag_1_slot": [l1],
            "lag_2_slots": [l2],
            "lag_prev_day": [lpd]
        }
        X = pd.DataFrame(feature_dict)[FEATURE_COLUMNS]
        pred = float(self.model.predict(X)[0])
        return max(0.0, round(pred, 1))

    def predict_horizon(
        self,
        date_str: str,
        start_time_slot: str,
        class_break: str = "no",
        campus_event: str = "no",
        horizon_slots: int = 1,
        historical_lookup: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Predicts sequential future slots, propagating predictions into subsequent lag features.
        """
        try:
            start_idx = ALL_TIME_SLOTS.index(start_time_slot)
        except ValueError:
            start_idx = 0

        end_idx = min(len(ALL_TIME_SLOTS), start_idx + horizon_slots)
        slots_to_predict = ALL_TIME_SLOTS[start_idx:end_idx]

        results = []
        recent_preds = []

        for slot in slots_to_predict:
            h, m, slot_idx = compute_slot_index(slot)

            # Determine lags: use recent predictions if available, else historical lookup or slot mean
            if len(recent_preds) >= 1:
                lag_1 = recent_preds[-1]
            else:
                lag_1 = self.slot_means.get(max(0, slot_idx - 1), self.slot_means.get(slot_idx, 30.0))

            if len(recent_preds) >= 2:
                lag_2 = recent_preds[-2]
            else:
                lag_2 = self.slot_means.get(max(0, slot_idx - 2), self.slot_means.get(slot_idx, 30.0))

            lag_prev_day = self.slot_means.get(slot_idx, 30.0)

            pred_val = self.predict_slot(
                date_str=date_str,
                time_slot=slot,
                class_break=class_break,
                campus_event=campus_event,
                lag_1=lag_1,
                lag_2=lag_2,
                lag_prev_day=lag_prev_day
            )
            recent_preds.append(pred_val)

            category, risk, rec_counters = self.categorize_demand(pred_val)

            actual_val = None
            if historical_lookup and slot in historical_lookup:
                actual_val = float(historical_lookup[slot])

            hist_avg = self.slot_means.get(slot_idx, round(pred_val, 1))

            notes = []
            if class_break.lower() == "yes":
                notes.append("Class break active (+surge)")
            if campus_event.lower() == "yes":
                notes.append("Campus event active")
            if (h == 12) or (h == 13 and m <= 45):
                notes.append("Lunch Rush Window")

            results.append({
                "time_slot": slot,
                "predicted_demand": pred_val,
                "demand_category": category,
                "predicted_queue_risk": risk,
                "recommended_counters": rec_counters,
                "actual_demand": actual_val,
                "historical_avg": round(hist_avg, 1),
                "notes": ", ".join(notes) if notes else "Standard Operational Window"
            })

        return results

predictor = DemandPredictor()
