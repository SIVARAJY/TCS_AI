# AI-Powered Canteen Queue and Counter Planning System

An enterprise-grade, full-stack, AI-driven operational decision support system built to predict canteen demand surges, optimize food counter openings, and dynamically allocate service staff during high-traffic lunch and break windows.

---

## 1. System Overview & Problem Statement

College canteens face extreme demand surges during 15-to-30 minute class break and lunch windows. Understaffing leads to long queues, excessive student waiting times, and lost sales; overstaffing leads to high labor costs and idle staff during off-peak hours.

This system answers the core operational questions:
1. **Expected Orders / Students:** How many orders are projected in each 15-minute time slot?
2. **Queue Risk:** Which upcoming slots will experience heavy queues?
3. **Counter Sizing:** How many counters (C1–C5) should be open?
4. **Staff Allocation:** How many staff members should be deployed to each active counter?
5. **Peak-Hour Directive:** What operational actions should supervisors execute before a rush starts?
6. **Model Reliability:** How accurately does the ML model predict demand without inventing accuracy percentages?

> **Demand Proxy Note:** In this application, *total orders served across all counters* in a 15-minute slot is used as the proxy for demand (served throughput). It is not a direct sensor count of every individual walking through the canteen doors.

---

## 2. Project Architecture & Clean Directory Layout

```
CANTEEN/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py             # FastAPI REST endpoints
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── optimization_service.py # Queueing & staff allocation logic
│   │   │   ├── prediction_service.py   # Data aggregation & prediction service
│   │   │   └── report_service.py       # CSV report & peak plan generator
│   │   ├── __init__.py
│   │   ├── config.py                 # Paths, operational thresholds, defaults
│   │   ├── data_processing.py        # Validation, cleaning, feature engineering
│   │   ├── main.py                   # FastAPI application with CORS
│   │   └── schemas.py                # Pydantic v2 request/response schemas
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── train_model.py            # Chronological ML training & evaluation
│   │   └── predict.py                # Autoregressive multi-horizon predictor
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_canteen_system.py    # 13 automated pytest test cases
│   ├── .env.example
│   └── requirements.txt              # Python dependencies
├── data/
│   └── synthetic_canteen_data.csv    # Original 100,000 transaction records
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx            # Real-time backend status header
│   │   │   └── Sidebar.jsx           # Clean navigation sidebar
│   │   ├── pages/
│   │   │   ├── CounterOptimization.jsx # Interactive staff & counter tuning
│   │   │   ├── Dashboard.jsx         # KPI overview & live forecast card
│   │   │   ├── DatasetUpload.jsx     # Upload, validate, preview & reset
│   │   │   ├── FootfallPrediction.jsx# Multi-horizon forecast & line chart
│   │   │   ├── ModelPerformance.jsx  # MAE, RMSE, R², residuals, feature importance
│   │   │   ├── PeakHourPlan.jsx      # Step-by-step supervisor action plan
│   │   │   └── Reports.jsx           # CSV export generator with timestamps
│   │   ├── services/
│   │   │   └── api.js                # Centralized backend HTTP client
│   │   ├── App.jsx                   # Tab controller and top layout
│   │   ├── index.css                 # Tailwind directives
│   │   └── main.jsx                  # React 18 DOM mount
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js                # Vite configuration with /api proxy
├── outputs/
│   ├── baseline_model.joblib         # DummyRegressor model artifact
│   ├── feature_importance.json       # RandomForest feature weights
│   ├── model_metrics.json            # MAE, RMSE, R² comparison metrics
│   ├── rf_demand_model.joblib        # Trained RandomForestRegressor model
│   ├── slot_historical_means.json    # Pre-computed slot mean fallbacks
│   └── test_predictions_sample.json # 50 held-out test predictions
└── README.md                         # Project documentation
```

---

## 3. Dataset Inspection & Quality Diagnostics

- **Raw Dimensions:** 100,000 rows × 9 columns.
- **Aggregated Dimensions:** 20,000 slots (500 days × 40 slots/day from 08:00 to 18:00).
- **Date Range:** `2023-07-03` to `2025-05-30` (500 distinct dates).
- **Physical Counters:** 5 counters (`C1`, `C2`, `C3`, `C4`, `C5`).
- **Data Quality:**
  - Missing Values: **0** across all 9 columns.
  - Duplicate Records: **0** duplicates.
  - Data Types: `date` (string/date), `time_slot` (string `HH:MM-HH:MM`), `counter_id` (string), `orders_served` (int), `queue_length` (int), `avg_wait_min` (float), `staff_on_duty` (int), `class_break` (`yes`/`no`), `campus_event` (`yes`/`no`).
- **Empirical Capacity & Workload Observations:**
  - Active counters average **11.9 orders per staff per 15-minute slot** (up to ~18–20 orders at peak).
  - Maximum counter throughput observed is **36 orders / slot** (with 2 staff members).
  - Average slot demand is **34.8 orders**, peaking at **138 orders** during synchronized lunch break surges.

---

## 4. Machine Learning Demand Forecasting

### Prevention of Data Leakage
- **Chronological Split:** The first 80% of dates (`2023-07-03` to `2025-01-10`, 16,000 slots) form the training set. The remaining 20% of dates (`2025-01-13` to `2025-05-30`, 4,000 slots) are held out strictly for testing.
- **No Future Leakage:** Target slot actuals, waiting times, and queue lengths are **never** used as features.
- **Autoregressive Lags:** Lag features (`lag_1_slot`, `lag_2_slots`, `lag_prev_day`) use only data chronologically prior to the predicted slot. Missing lags for early morning slots are populated strictly using historical slot averages computed on the training set.

### Engineered Features
1. `hour`: Integer time of day (8–17).
2. `minute`: Slot quarter hour (0, 15, 30, 45).
3. `slot_index`: 0 to 39 for the 40 slots in an operating day.
4. `day_of_week`: 0 (Monday) to 4 (Friday).
5. `month`: 1 to 12.
6. `is_lunch_peak`: Binary flag for 12:15–13:45.
7. `is_morning_break`: Binary flag for 10:15–11:15.
8. `is_afternoon_break`: Binary flag for 15:15–15:45.
9. `class_break_num`: Binary indicator (1 for `yes`, 0 for `no`).
10. `campus_event_num`: Binary indicator (1 for `yes`, 0 for `no`).
11. `lag_1_slot`: Demand from the immediately preceding 15-minute slot.
12. `lag_2_slots`: Demand from 30 minutes prior.
13. `lag_prev_day`: Demand at the exact same time slot on the previous day.

### Empirical Model Evaluation (Held-Out Test Period)

| Model Architecture | MAE (Orders) | RMSE (Orders) | $R^2$ Score | Status |
| :--- | :---: | :---: | :---: | :---: |
| **RandomForestRegressor (Selected)** | **7.599** | **10.987** | **0.790** | **Production** |
| **HistGradientBoostingRegressor** | 7.484 | 10.827 | 0.796 | Benchmark |
| **DummyRegressor (Mean Baseline)** | 19.025 | 23.983 | -0.001 | Baseline |

> **Regression Metrics Disclosure:** Because demand forecasting is a continuous numerical estimation problem, classification accuracy percentages are not mathematically valid. Model quality is assessed via MAE (average order deviation), RMSE (penalizing larger deviations), and $R^2$ (explaining ~79% of total variance over the naive baseline).

### Top Predictive Feature Importances
1. `lag_1_slot` (**45.2%**): Immediate momentum of student arrivals.
2. `class_break_num` (**24.2%**): Class dismissal surges drive instant footfall spikes.
3. `slot_index` (**10.9%**): Time-of-day progression across the 40 slots.
4. `is_lunch_peak` (**6.9%**): Core meal rush between 12:15 and 13:45.
5. `lag_2_slots` (**3.9%**): Half-hour trend continuity.

---

## 5. Counter & Staff Optimization Algorithm

The optimization service translates forecast demand into physical counter allocations:

1. **Required Capacity Calculation:**
   $$\text{Required Staff } S_{\text{req}} = \left\lceil \frac{\text{Demand}}{\text{Service Rate per Staff} \times \text{Target Utilization}} \right\rceil = \left\lceil \frac{D}{15.0 \times 0.80} \right\rceil$$
2. **Staff Allocation Constraints:**
   $$S_{\text{alloc}} = \min(S_{\text{avail}}, S_{\text{req}}, C_{\text{max}} \times 2)$$
3. **Counter Sizing:**
   $$\text{Open Counters } = \min\left(C_{\text{max}}, \max\left(1, \lceil S_{\text{alloc}} / 2 \rceil\right)\right)$$
4. **Hierarchical Counter Assignment:**
   - C1 (Primary Express) and C2 (Specials) receive 2 staff each during peaks.
   - C3 (Beverages/Snacks) receives 1–2 staff.
   - C4 (Overflow) opens when demand exceeds 70 orders.
   - C5 (Surge Auxiliary) opens only during extreme surges (>90 orders).
5. **Overload Warning:**
   If $S_{\text{req}} > S_{\text{avail}}$, the system raises `is_overload = true`, computes the staff deficit, estimates queue buildup, and generates emergency directives (e.g., pre-packaged meals, mobile queues, staggering breaks).

---

## 6. API Reference (FastAPI Backend)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health status, dataset presence, and model readiness. |
| `GET` | `/api/data/summary` | Dataset shape, date range, columns, counter stats, and hourly distributions. |
| `GET` | `/api/data/preview` | Preview first N records (default 10). |
| `POST` | `/api/data/upload` | Multipart CSV file upload, schema validation, and storage. |
| `POST` | `/api/data/reset-sample` | Reset data to default 100,000 synthetic canteen records. |
| `GET` | `/api/data/download-clean` | Download aggregated slot dataset as CSV. |
| `POST` | `/api/predict` | Predict demand for a specific slot or sequential multi-slot horizon. |
| `POST` | `/api/optimize` | Calculate open counters, crew allocation, and utilization. |
| `POST` | `/api/reports/peak-plan` | Generate full-day supervisory action directives for rush hours. |
| `GET` | `/api/model/metrics` | Retrieve MAE, RMSE, $R^2$, and held-out test predictions. |
| `GET` | `/api/model/feature-importance` | Feature importance ranking from RandomForestRegressor. |
| `GET` | `/api/reports/predictions` | Download full prediction horizon as CSV. |
| `GET` | `/api/reports/counters` | Download counter optimization plan as CSV. |
| `GET` | `/api/reports/action-plan` | Download peak-hour action plan as CSV. |

---

## 7. How to Run the Project (Windows PowerShell)

### Prerequisites
- Python 3.10+
- Node.js LTS (v20+ or v26+)

### Step 1: Install Backend Dependencies & Train Model
```powershell
# In CANTEEN workspace root
python -m pip install -r backend/requirements.txt

# Run model training & generate outputs
python backend/ml/train_model.py

# Run backend automated test suite (13 tests)
$env:PYTHONPATH = "backend"
python -m pytest backend/tests/test_canteen_system.py -v
```

### Step 2: Start the FastAPI Backend
```powershell
# Start backend on port 8000
$env:PYTHONPATH = "backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### Step 3: Install Frontend Dependencies & Start Vite
```powershell
# Open a new PowerShell terminal
cd frontend
npm install
npm run dev
```
- Frontend Dashboard: `http://localhost:5173/`

---

## 8. Interactive Scenario Testing Guide

1. **Test Lunch Surge Scenario:**
   - Go to **Footfall Prediction**.
   - Select Date: `2025-05-30`, Start Slot: `12:00-12:15`, Class Break: `yes`, Horizon: `8 Slots`.
   - Click **Run Forecast**. Observe demand jumping from ~35 orders at 12:00 to ~82 orders at 12:45.
2. **Test Staff Shortage / Overload Scenario:**
   - Go to **Counter Optimization**.
   - Set Projected Demand: `100 orders`, Available Staff: `3 staff`, Target Wait: `3.0 min`.
   - Click **Calculate Optimal Allocation**.
   - Observe the **Capacity Overload Warning** banner with staff deficit and emergency mitigation steps.
3. **Test Off-Peak Window:**
   - Set Projected Demand: `18 orders`, Available Staff: `8 staff`.
   - Observe system recommending only **Counter C1 Open with 1 staff** and suggesting reassigning surplus crew to prep duties.
4. **Export Reports:**
   - Go to **Export Reports**. Click **Export Predictions (CSV)** or **Export Action Plan (CSV)** to download stamped spreadsheets.

---

## 9. Assumptions, Limitations & Future Enhancements

1. **Proxy Nature of Demand:** Total orders served reflects realized canteen throughput. During severe overcrowding, unserved students who leave without ordering are not recorded.
2. **Menu Item Granularity:** Orders are aggregated numerically; prep time differences between simple beverages and custom hot meals are averaged across counters.
3. **Future Extension:** Integration with campus turnstile RFID sensors or Wi-Fi density tracking would provide true pre-order footfall counts.
