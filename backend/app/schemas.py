from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    dataset_loaded: bool
    model_loaded: bool
    total_records: int
    model_name: str
    dataset_file: str

class CounterStat(BaseModel):
    counter_id: str
    total_orders: int
    avg_orders_per_slot: float
    avg_queue_length: float
    avg_wait_min: float
    max_staff_observed: int

class HourlyDistItem(BaseModel):
    time_slot: str
    avg_demand: float
    max_demand: float
    min_demand: float
    peak_category: str

class DataSummaryResponse(BaseModel):
    total_records: int
    total_aggregate_slots: int
    columns: List[str]
    date_range: Dict[str, Any]
    missing_values: Dict[str, int]
    duplicate_rows: int
    total_historical_orders: int
    avg_queue_length: float
    avg_wait_min: float
    counter_stats: List[CounterStat]
    hourly_distribution: List[HourlyDistItem]
    is_sample_dataset: bool

class PreviewResponse(BaseModel):
    columns: List[str]
    records: List[Dict[str, Any]]
    total_rows: int

class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    row_count: int
    detected_columns: List[str]

class PredictRequest(BaseModel):
    date: str = Field(..., description="Target date in YYYY-MM-DD format")
    time_slot: str = Field(..., description="15-minute time slot e.g. 12:30-12:45")
    class_break: str = Field("no", description="'yes' or 'no'")
    campus_event: str = Field("no", description="'yes' or 'no'")
    horizon_slots: int = Field(1, ge=1, le=40, description="Number of consecutive slots to predict")

class SlotPredictionItem(BaseModel):
    time_slot: str
    predicted_demand: float
    demand_category: str
    predicted_queue_risk: str
    recommended_counters: int
    actual_demand: Optional[float] = None
    historical_avg: Optional[float] = None
    notes: str

class PredictResponse(BaseModel):
    date: str
    slots: List[SlotPredictionItem]
    generated_at: str
    model_used: str

class CounterAllocationItem(BaseModel):
    counter_id: str
    status: str  # 'Open' or 'Closed'
    staff_allocated: int
    historical_orders_served: Optional[float] = None
    expected_capacity: float
    expected_utilization_pct: float
    queue_length_est: float
    avg_wait_min_est: float
    reason: str

class OptimizeRequest(BaseModel):
    predicted_demand: Optional[float] = None
    date: Optional[str] = None
    time_slot: Optional[str] = "12:30-12:45"
    class_break: Optional[str] = "no"
    campus_event: Optional[str] = "no"
    available_staff: Optional[int] = Field(8, ge=1, le=15)
    max_counters: Optional[int] = Field(5, ge=1, le=5)
    target_wait_min: Optional[float] = Field(3.0, ge=0.5, le=15.0)
    service_rate_per_staff: Optional[float] = Field(15.0, ge=5.0, le=30.0)
    max_counter_capacity: Optional[float] = Field(36.0, ge=10.0, le=50.0)

class OptimizeResponse(BaseModel):
    demand_analyzed: float
    demand_source: str
    time_slot: Optional[str]
    date: Optional[str]
    total_available_staff: int
    total_staff_allocated: int
    max_counters_available: int
    open_counters_count: int
    target_wait_min: float
    estimated_wait_min: float
    estimated_queue_length: float
    overall_utilization_pct: float
    is_overload: bool
    overload_warning: Optional[str] = None
    counters: List[CounterAllocationItem]
    action_recommendations: List[str]

class PeakHourActionItem(BaseModel):
    time_slot: str
    demand_level: str
    projected_demand: float
    recommended_open_counters: int
    recommended_staff: int
    action: str
    expected_outcome: str

class PeakHourPlanResponse(BaseModel):
    date: str
    total_peak_slots: int
    items: List[PeakHourActionItem]

class ModelMetricsResponse(BaseModel):
    model_name: str
    baseline_name: str
    train_records: int
    test_records: int
    split_type: str
    train_date_range: Dict[str, str]
    test_date_range: Dict[str, str]
    baseline_metrics: Dict[str, float]
    model_metrics: Dict[str, float]
    gradient_boosting_metrics: Optional[Dict[str, float]] = None
    actual_vs_predicted_sample: List[Dict[str, Any]]
    residual_sample: List[Dict[str, Any]]
    explanation: str

class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float
    description: str

class FeatureImportanceResponse(BaseModel):
    model_name: str
    features: List[FeatureImportanceItem]
