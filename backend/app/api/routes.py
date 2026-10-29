import io
import json
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional, List, Dict, Any

from ..config import (
    DEFAULT_DATA_FILE,
    METRICS_FILE,
    FEATURE_IMPORTANCE_FILE,
    TEST_SAMPLE_FILE,
    DATA_DIR
)
from ..schemas import (
    HealthResponse,
    DataSummaryResponse,
    PreviewResponse,
    PredictRequest,
    PredictResponse,
    OptimizeRequest,
    OptimizeResponse,
    PeakHourPlanResponse,
    ModelMetricsResponse,
    FeatureImportanceResponse
)
from ..data_processing import validate_dataframe, clean_dataframe, aggregate_by_slot
from ..services.prediction_service import (
    data_manager,
    predict_canteen_demand,
    predictor
)
from ..services.optimization_service import optimize_counters_and_staff
from ..services.report_service import (
    generate_peak_hour_plan,
    export_predictions_csv,
    export_counter_optimization_csv,
    export_action_plan_csv
)

router = APIRouter(prefix="/api")

@router.get("/data/time-slots", response_model=List[str])
def get_all_time_slots():
    """
    Returns the complete list of all 40 15-minute time slots in an operating college day (08:00 to 18:00).
    """
    from ..config import ALL_TIME_SLOTS
    return ALL_TIME_SLOTS

@router.get("/health", response_model=HealthResponse)
def health_check():
    """
    Checks backend service status, dataset availability, and ML model readiness.
    """
    dataset_ready = data_manager.is_loaded()
    model_ready = predictor.is_ready()
    total_records = len(data_manager.raw_df) if dataset_ready else 0

    return HealthResponse(
        status="healthy" if (dataset_ready and model_ready) else "degraded",
        dataset_loaded=dataset_ready,
        model_loaded=model_ready,
        total_records=total_records,
        model_name="RandomForestRegressor (100 Trees, Max Depth 12)",
        dataset_file=str(data_manager.dataset_path.name)
    )

@router.get("/data/summary", response_model=DataSummaryResponse)
def get_data_summary():
    """
    Returns comprehensive dataset statistics, date ranges, and counter metrics.
    """
    if not data_manager.is_loaded():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset is not loaded. Please upload a dataset or ensure synthetic_canteen_data.csv exists."
        )
    try:
        summary = data_manager.get_summary()
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error computing dataset summary: {str(e)}"
        )

@router.get("/data/preview", response_model=PreviewResponse)
def get_data_preview(limit: int = Query(10, ge=1, le=100)):
    """
    Returns first N records of the loaded dataset for previewing.
    """
    if not data_manager.is_loaded():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset is not loaded. Please upload a dataset first."
        )
    return data_manager.get_preview(limit=limit)

@router.post("/data/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Accepts CSV upload, validates columns/types, updates backend dataset, and returns summary.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid CSV file (.csv)."
        )

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse CSV file: {str(e)}"
        )

    val = validate_dataframe(df)
    if not val["is_valid"]:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "message": "Dataset validation failed.",
                "validation": val
            }
        )

    # Save uploaded file
    cleaned = clean_dataframe(df)
    save_path = DATA_DIR / f"uploaded_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    cleaned.to_csv(save_path, index=False)

    # Reload data manager with newly uploaded data
    data_manager.reload(str(save_path))

    return {
        "message": "Dataset successfully uploaded, validated, and loaded.",
        "filename": file.filename,
        "rows": len(cleaned),
        "columns": list(cleaned.columns),
        "validation": val,
        "summary": data_manager.get_summary()
    }

@router.post("/data/reset-sample")
def reset_sample_dataset():
    """
    Resets the backend data to the default synthetic canteen dataset.
    """
    if not DEFAULT_DATA_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Default sample dataset file not found at {DEFAULT_DATA_FILE}."
        )
    data_manager.reload(str(DEFAULT_DATA_FILE))
    return {
        "message": "Reset to default synthetic canteen dataset successfully.",
        "summary": data_manager.get_summary()
    }

@router.get("/data/download-clean")
def download_clean_data():
    """
    Provides a download stream of the aggregated slot dataset.
    """
    if not data_manager.is_loaded() or data_manager.agg_df is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No aggregated data available to download."
        )

    csv_data = data_manager.agg_df.to_csv(index=False)
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cleaned_aggregated_canteen_demand.csv"}
    )

@router.post("/predict", response_model=PredictResponse)
def predict_demand(req: PredictRequest):
    """
    Predicts demand for the selected 15-minute slot or upcoming slots.
    """
    if not predictor.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction model is not loaded. Please train or load the model first."
        )
    try:
        return predict_canteen_demand(req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {str(e)}"
        )

@router.post("/optimize", response_model=OptimizeResponse)
def optimize_counters(req: OptimizeRequest):
    """
    Optimizes counter openings and staff allocations based on demand.
    If demand is not explicitly provided, forecasts demand using the ML model.
    """
    demand = req.predicted_demand
    demand_source = "Direct User Input"

    if demand is None or demand <= 0:
        if not predictor.is_ready():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either specify predicted_demand or ensure the ML model is trained for automated forecasting."
            )
        date_val = req.date if req.date else datetime.now().strftime("%Y-%m-%d")
        slot_val = req.time_slot if req.time_slot else "12:30-12:45"
        
        demand = predictor.predict_slot(
            date_str=date_val,
            time_slot=slot_val,
            class_break=req.class_break or "no",
            campus_event=req.campus_event or "no"
        )
        demand_source = "Model Forecast"

    # Historical counter stats lookup
    hist_stats = {}
    if req.time_slot and data_manager.is_loaded():
        hist_stats = data_manager.get_historical_counter_stats_for_slot(req.time_slot)

    opt = optimize_counters_and_staff(
        demand=demand,
        available_staff=req.available_staff or 8,
        max_counters=req.max_counters or 5,
        target_wait_min=req.target_wait_min or 3.0,
        service_rate_per_staff=req.service_rate_per_staff or 15.0,
        max_counter_capacity=req.max_counter_capacity or 36.0,
        time_slot=req.time_slot,
        date_str=req.date,
        demand_source=demand_source,
        historical_counter_stats=hist_stats
    )
    return opt

@router.post("/reports/peak-plan", response_model=PeakHourPlanResponse)
def get_peak_hour_plan(
    date: str = Query(..., description="Target date in YYYY-MM-DD"),
    class_break: str = Query("no"),
    campus_event: str = Query("no"),
    available_staff: int = Query(8, ge=1, le=15),
    max_counters: int = Query(5, ge=1, le=5)
):
    """
    Generates a full-day peak hour action plan for high-demand slots on the specified date.
    """
    if not predictor.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model not available."
        )

    # Predict all 40 slots for the date
    hist_lookup = data_manager.get_historical_demand_lookup(date) if data_manager.is_loaded() else {}
    slots_data = predictor.predict_horizon(
        date_str=date,
        start_time_slot="08:00-08:15",
        class_break=class_break,
        campus_event=campus_event,
        horizon_slots=40,
        historical_lookup=hist_lookup
    )

    plan = generate_peak_hour_plan(
        predictions=slots_data,
        date_str=date,
        available_staff=available_staff,
        max_counters=max_counters
    )
    return plan

@router.get("/model/metrics", response_model=ModelMetricsResponse)
def get_model_metrics():
    """
    Returns actual evaluation metrics (MAE, RMSE, R2) and sample test comparisons.
    """
    if not METRICS_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model metrics file not found. Please run model training first."
        )

    with open(METRICS_FILE, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    actual_vs_pred = []
    if TEST_SAMPLE_FILE.exists():
        with open(TEST_SAMPLE_FILE, "r", encoding="utf-8") as f:
            actual_vs_pred = json.load(f)

    # Calculate residual distribution
    residuals = [
        {"slot": item["time_slot"], "residual": item["residual"], "actual": item["actual_demand"], "predicted": item["predicted_demand"]}
        for item in actual_vs_pred
    ]

    metrics["actual_vs_predicted_sample"] = actual_vs_pred
    metrics["residual_sample"] = residuals
    return metrics

@router.get("/model/feature-importance", response_model=FeatureImportanceResponse)
def get_feature_importance():
    """
    Returns feature importance rankings from the trained RandomForest model.
    """
    if not FEATURE_IMPORTANCE_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature importance file not found. Please train model first."
        )

    with open(FEATURE_IMPORTANCE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@router.get("/reports/predictions")
def export_predictions_report(
    date: str = Query(..., description="Target date YYYY-MM-DD"),
    class_break: str = Query("no"),
    campus_event: str = Query("no"),
    horizon: int = Query(40, ge=1, le=40)
):
    """
    Exports full day or multi-slot footfall predictions to downloadable CSV.
    """
    if not predictor.is_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model unavailable")

    hist_lookup = data_manager.get_historical_demand_lookup(date) if data_manager.is_loaded() else {}
    slots_data = predictor.predict_horizon(
        date_str=date,
        start_time_slot="08:00-08:15",
        class_break=class_break,
        campus_event=campus_event,
        horizon_slots=horizon,
        historical_lookup=hist_lookup
    )

    csv_text = export_predictions_csv(slots_data, date)
    return StreamingResponse(
        io.StringIO(csv_text),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=canteen_predictions_{date}.csv"}
    )

@router.get("/reports/counters")
def export_counter_report(
    demand: float = Query(..., ge=1.0),
    time_slot: str = Query("12:30-12:45"),
    date: str = Query(datetime.now().strftime("%Y-%m-%d")),
    available_staff: int = Query(8)
):
    """
    Exports counter recommendation report to CSV.
    """
    opt = optimize_counters_and_staff(
        demand=demand,
        available_staff=available_staff,
        time_slot=time_slot,
        date_str=date
    )
    csv_text = export_counter_optimization_csv(opt.model_dump())
    return StreamingResponse(
        io.StringIO(csv_text),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=counter_recommendations_{time_slot.replace(':', '')}.csv"}
    )

@router.get("/reports/action-plan")
def export_action_plan_report(
    date: str = Query(..., description="Target date YYYY-MM-DD"),
    class_break: str = Query("no"),
    campus_event: str = Query("no")
):
    """
    Exports peak-hour action plan to CSV.
    """
    if not predictor.is_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model unavailable")

    hist_lookup = data_manager.get_historical_demand_lookup(date) if data_manager.is_loaded() else {}
    slots_data = predictor.predict_horizon(
        date_str=date,
        start_time_slot="08:00-08:15",
        class_break=class_break,
        campus_event=campus_event,
        horizon_slots=40,
        historical_lookup=hist_lookup
    )

    plan = generate_peak_hour_plan(predictions=slots_data, date_str=date)
    csv_text = export_action_plan_csv(plan)
    return StreamingResponse(
        io.StringIO(csv_text),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=peak_hour_action_plan_{date}.csv"}
    )
