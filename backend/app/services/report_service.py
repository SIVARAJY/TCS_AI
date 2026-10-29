import io
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from ..schemas import PeakHourActionItem, PeakHourPlanResponse
from ..services.optimization_service import optimize_counters_and_staff

def generate_peak_hour_plan(
    predictions: List[Dict[str, Any]],
    date_str: str,
    available_staff: int = 8,
    max_counters: int = 5,
    demand_threshold: float = 50.0
) -> PeakHourPlanResponse:
    """
    Generates operational peak-hour action plans for all slots meeting the high-demand threshold.
    """
    items: List[PeakHourActionItem] = []

    for slot_item in predictions:
        dem = float(slot_item["predicted_demand"])
        slot = slot_item["time_slot"]

        # Peak hours are slots with high demand or category High/Surge
        if dem >= demand_threshold or slot_item.get("demand_category") in ["High", "Surge"]:
            opt = optimize_counters_and_staff(
                demand=dem,
                available_staff=available_staff,
                max_counters=max_counters,
                time_slot=slot,
                date_str=date_str
            )

            # Operational action based on slot and severity
            level = slot_item.get("demand_category", "High")
            if level == "Surge":
                action = (
                    f"Deploy full capacity: Open Counters C1 through C{opt.open_counters_count}. "
                    f"Reassign {opt.total_staff_allocated} staff to active counter service. "
                    "Pre-stage express meal trays 5 minutes before slot start. Enable mobile/cashless fast queue."
                )
                expected_outcome = (
                    f"Absorbs surge flow of {round(dem, 0)} orders; limits queue buildup to ~{opt.estimated_queue_length} students "
                    f"and holds average wait time at ~{opt.estimated_wait_min} min."
                )
            else:
                action = (
                    f"Activate {opt.open_counters_count} counters with {opt.total_staff_allocated} staff. "
                    "Ensure Counters C1 and C2 have dual staff for order taking and food plating."
                )
                expected_outcome = (
                    f"Maintains counter utilization at {opt.overall_utilization_pct}%; "
                    f"keeps student wait time at approximately {opt.estimated_wait_min} min (Target: {opt.target_wait_min} min)."
                )

            items.append(PeakHourActionItem(
                time_slot=slot,
                demand_level=level,
                projected_demand=round(dem, 1),
                recommended_open_counters=opt.open_counters_count,
                recommended_staff=opt.total_staff_allocated,
                action=action,
                expected_outcome=expected_outcome
            ))

    return PeakHourPlanResponse(
        date=date_str,
        total_peak_slots=len(items),
        items=items
    )

def export_predictions_csv(predictions: List[Dict[str, Any]], date_str: str) -> str:
    """
    Exports predictions to a formatted CSV string.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Time Slot",
        "Predicted Demand (Orders)",
        "Demand Category",
        "Queue Risk",
        "Recommended Open Counters",
        "Historical Avg Demand",
        "Actual Demand (if available)",
        "Operational Notes",
        "Generated At"
    ])

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for p in predictions:
        writer.writerow([
            date_str,
            p.get("time_slot", ""),
            p.get("predicted_demand", 0.0),
            p.get("demand_category", ""),
            p.get("predicted_queue_risk", ""),
            p.get("recommended_counters", 1),
            p.get("historical_avg", ""),
            p.get("actual_demand", ""),
            p.get("notes", ""),
            timestamp
        ])

    return output.getvalue()

def export_counter_optimization_csv(opt_data: Dict[str, Any]) -> str:
    """
    Exports counter optimization recommendations to a formatted CSV string.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["# CANTEEN COUNTER & STAFF OPTIMIZATION REPORT"])
    writer.writerow(["Date", opt_data.get("date", "N/A")])
    writer.writerow(["Time Slot", opt_data.get("time_slot", "N/A")])
    writer.writerow(["Analyzed Demand", opt_data.get("demand_analyzed", 0)])
    writer.writerow(["Available Staff", opt_data.get("total_available_staff", 0)])
    writer.writerow(["Allocated Staff", opt_data.get("total_staff_allocated", 0)])
    writer.writerow(["Open Counters", opt_data.get("open_counters_count", 0)])
    writer.writerow(["Target Wait (min)", opt_data.get("target_wait_min", 0)])
    writer.writerow(["Estimated Wait (min)", opt_data.get("estimated_wait_min", 0)])
    writer.writerow(["System Utilization", f"{opt_data.get('overall_utilization_pct', 0)}%"])
    writer.writerow(["Overload Status", "YES (Deficit)" if opt_data.get("is_overload") else "NO (Normal)"])
    writer.writerow([])

    writer.writerow([
        "Counter ID",
        "Status",
        "Staff Allocated",
        "Expected Capacity (Orders)",
        "Utilization %",
        "Estimated Queue",
        "Estimated Wait (min)",
        "Recommendation Reason"
    ])

    for c in opt_data.get("counters", []):
        writer.writerow([
            c.get("counter_id"),
            c.get("status"),
            c.get("staff_allocated"),
            c.get("expected_capacity"),
            f"{c.get('expected_utilization_pct')}%",
            c.get("queue_length_est"),
            c.get("avg_wait_min_est"),
            c.get("reason")
        ])

    return output.getvalue()

def export_action_plan_csv(plan: PeakHourPlanResponse) -> str:
    """
    Exports peak-hour operational action plan to CSV.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Time Slot",
        "Demand Level",
        "Projected Demand",
        "Recommended Open Counters",
        "Recommended Staff",
        "Operational Action",
        "Expected Outcome"
    ])

    for it in plan.items:
        writer.writerow([
            plan.date,
            it.time_slot,
            it.demand_level,
            it.projected_demand,
            it.recommended_open_counters,
            it.recommended_staff,
            it.action,
            it.expected_outcome
        ])

    return output.getvalue()
