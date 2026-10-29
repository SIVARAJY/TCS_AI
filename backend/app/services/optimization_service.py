import math
from typing import Dict, Any, List, Optional
from ..config import (
    DEFAULT_MAX_COUNTERS,
    DEFAULT_AVAILABLE_STAFF,
    DEFAULT_SERVICE_RATE_PER_STAFF,
    DEFAULT_MAX_COUNTER_CAPACITY,
    DEFAULT_TARGET_WAIT_MIN
)
from ..schemas import CounterAllocationItem, OptimizeResponse

COUNTER_NAMES = ["C1", "C2", "C3", "C4", "C5"]
COUNTER_DESCRIPTIONS = {
    "C1": "Primary Express Meals Counter",
    "C2": "Secondary Hot Food & Specials Counter",
    "C3": "Snacks, Beverages & Quick Pick Counter",
    "C4": "Overflow Meal Service Counter",
    "C5": "Surge Peak-Hour Auxiliary Counter"
}

def optimize_counters_and_staff(
    demand: float,
    available_staff: int = DEFAULT_AVAILABLE_STAFF,
    max_counters: int = DEFAULT_MAX_COUNTERS,
    target_wait_min: float = DEFAULT_TARGET_WAIT_MIN,
    service_rate_per_staff: float = DEFAULT_SERVICE_RATE_PER_STAFF,
    max_counter_capacity: float = DEFAULT_MAX_COUNTER_CAPACITY,
    time_slot: Optional[str] = None,
    date_str: Optional[str] = None,
    demand_source: str = "Model Forecast",
    historical_counter_stats: Optional[Dict[str, float]] = None
) -> OptimizeResponse:
    """
    Optimizes counter openings and staff allocations given projected demand,
    service rates, and staff constraints.
    """
    demand = max(1.0, float(demand))
    available_staff = max(1, min(15, available_staff))
    max_counters = max(1, min(5, max_counters))
    target_wait_min = max(0.5, float(target_wait_min))
    service_rate = max(5.0, float(service_rate_per_staff))
    max_cap_per_counter = max(10.0, float(max_counter_capacity))

    # Target utilization to keep queues bounded (80% target)
    target_utilization = 0.80
    effective_staff_capacity = service_rate * target_utilization
    required_staff = max(1, math.ceil(demand / effective_staff_capacity))

    # Allocated staff capped by available staff and physical counter capacity (max 2 staff per counter)
    physical_max_staff = max_counters * 2
    allocated_staff = min(available_staff, required_staff, physical_max_staff)

    # Check for deficit / overload
    is_overload = required_staff > available_staff
    overload_warning = None
    if is_overload:
        deficit = required_staff - available_staff
        overload_warning = (
            f"Staff Shortage Warning: Current demand ({round(demand, 1)} orders) requires {required_staff} staff "
            f"to maintain target wait time of {target_wait_min:.1f} min, but only {available_staff} staff are available. "
            f"Staff deficit: {deficit} staff member(s)."
        )

    # Determine how many counters to open
    # At least 1 counter; each counter holds up to 2 staff
    num_open_counters = min(max_counters, max(1, math.ceil(allocated_staff / 2)))

    # Allocate staff: 1 staff to each open counter first, then 2nd staff to busiest counters
    counter_staff_counts = {cid: 0 for cid in COUNTER_NAMES[:max_counters]}
    
    # Pass 1: 1 staff per open counter
    remaining = allocated_staff
    for i in range(num_open_counters):
        if remaining > 0:
            cid = COUNTER_NAMES[i]
            counter_staff_counts[cid] = 1
            remaining -= 1

    # Pass 2: assign 2nd staff to open counters starting from C1
    for i in range(num_open_counters):
        if remaining > 0:
            cid = COUNTER_NAMES[i]
            counter_staff_counts[cid] += 1
            remaining -= 1

    # Calculate per-counter capacity, load, utilization, wait times
    total_capacity = sum(
        min(max_cap_per_counter, counter_staff_counts[cid] * service_rate)
        for cid in COUNTER_NAMES[:max_counters]
    )

    overall_utilization = round(min(100.0, (demand / total_capacity) * 100.0), 1) if total_capacity > 0 else 100.0

    # Queuing estimation: M/M/c approximation
    rho = min(0.98, demand / max(1.0, total_capacity))
    if not is_overload:
        # Stable queue
        estimated_wait_min = round(max(0.3, (rho / (1.0 - rho + 0.1)) * (15.0 / total_capacity) * 2.5), 1)
        estimated_queue_length = round(max(0.0, rho * (demand / 15.0) * estimated_wait_min), 1)
    else:
        # Overloaded queue
        unserved = max(0.0, demand - total_capacity)
        estimated_queue_length = round(max(5.0, (demand / 15.0) * target_wait_min + unserved * 0.5), 1)
        estimated_wait_min = round(max(target_wait_min + 1.5, (estimated_queue_length / (total_capacity / 15.0))), 1)

    # Build counter details
    counters_res: List[CounterAllocationItem] = []
    
    # Proportionate demand allocation for open counters
    open_cids = [cid for cid in COUNTER_NAMES[:max_counters] if counter_staff_counts[cid] > 0]
    total_open_staff = sum(counter_staff_counts[cid] for cid in open_cids)

    for i in range(max_counters):
        cid = COUNTER_NAMES[i]
        staff_cnt = counter_staff_counts[cid]
        status = "Open" if staff_cnt > 0 else "Closed"
        cap = min(max_cap_per_counter, staff_cnt * service_rate) if status == "Open" else 0.0

        if status == "Open":
            # Share of demand
            counter_demand = (staff_cnt / max(1, total_open_staff)) * demand
            cnt_util = round(min(100.0, (counter_demand / max(1.0, cap)) * 100.0), 1)
            cnt_queue = round(estimated_queue_length / max(1, len(open_cids)), 1)
            cnt_wait = estimated_wait_min

            if staff_cnt == 2:
                reason = (
                    f"{COUNTER_DESCRIPTIONS[cid]}: Fully staffed with 2 crew members to maintain high throughput. "
                    f"Operating at {cnt_util}% capacity."
                )
            else:
                reason = (
                    f"{COUNTER_DESCRIPTIONS[cid]}: Staffed with 1 crew member to handle moderate service flow."
                )
        else:
            cnt_util = 0.0
            cnt_queue = 0.0
            cnt_wait = 0.0
            if is_overload:
                reason = (
                    f"{COUNTER_DESCRIPTIONS[cid]}: Counter currently CLOSED due to staff shortage. "
                    f"Deploying +1 staff would allow opening this counter and eliminating delays."
                )
            else:
                reason = (
                    f"{COUNTER_DESCRIPTIONS[cid]}: Closed. Projected demand of {round(demand, 1)} orders is fully satisfied "
                    f"by currently open counters ({', '.join(open_cids)})."
                )

        hist_orders = None
        if historical_counter_stats and cid in historical_counter_stats:
            hist_orders = historical_counter_stats[cid]

        counters_res.append(CounterAllocationItem(
            counter_id=cid,
            status=status,
            staff_allocated=staff_cnt,
            historical_orders_served=hist_orders,
            expected_capacity=cap,
            expected_utilization_pct=cnt_util,
            queue_length_est=cnt_queue,
            avg_wait_min_est=cnt_wait,
            reason=reason
        ))

    # Operational Recommendations
    action_recs: List[str] = []
    if is_overload:
        action_recs.append(
            f"URGENT: Forecast demand ({round(demand, 1)} orders) exceeds current staff capacity ({round(total_capacity, 1)} orders). "
            f"Call {required_staff - available_staff} auxiliary staff member(s) to counter duty."
        )
        action_recs.append("Activate grab-and-go meal packaging to reduce transaction time at counters C1 and C2.")
        action_recs.append("Open a dedicated cash-less quick checkout line on Counter C3 to accelerate throughput.")
        action_recs.append("Stagger classroom break dismissals across campus departments to smooth peak arrival surges.")
    elif overall_utilization > 80.0:
        action_recs.append(
            f"High Peak Alert: System utilization is {overall_utilization}%. Keep all {num_open_counters} counters fully active."
        )
        action_recs.append("Pre-stage meal trays and hot food items 5 minutes prior to slot start.")
    elif overall_utilization < 40.0:
        action_recs.append(
            f"Off-Peak Window: Demand is low ({round(demand, 1)} orders, {overall_utilization}% utilization). "
            f"Safely reassign {max(0, available_staff - allocated_staff)} staff to kitchen prep or restocking duties."
        )
    else:
        action_recs.append(
            f"Balanced Operations: {num_open_counters} counter(s) open with {allocated_staff} staff provides optimal flow "
            f"with an estimated average wait of {estimated_wait_min} min (well within target of {target_wait_min} min)."
        )

    return OptimizeResponse(
        demand_analyzed=round(demand, 1),
        demand_source=demand_source,
        time_slot=time_slot,
        date=date_str,
        total_available_staff=available_staff,
        total_staff_allocated=allocated_staff,
        max_counters_available=max_counters,
        open_counters_count=num_open_counters,
        target_wait_min=target_wait_min,
        estimated_wait_min=estimated_wait_min,
        estimated_queue_length=estimated_queue_length,
        overall_utilization_pct=overall_utilization,
        is_overload=is_overload,
        overload_warning=overload_warning,
        counters=counters_res,
        action_recommendations=action_recs
    )
