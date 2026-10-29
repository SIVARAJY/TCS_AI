import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { ALL_COLLEGE_TIME_SLOTS } from '../constants/timeSlots';

export default function CounterOptimization() {
  const [demandInput, setDemandInput] = useState(75.0);
  const [selectedSlot, setSelectedSlot] = useState('12:30-12:45');
  const [selectedDate, setSelectedDate] = useState('2025-05-30');
  const [availableStaff, setAvailableStaff] = useState(8);
  const [maxCounters, setMaxCounters] = useState(5);
  const [targetWaitMin, setTargetWaitMin] = useState(3.0);
  const [serviceRate, setServiceRate] = useState(15.0);
  const [loading, setLoading] = useState(false);
  const [optData, setOptData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    handleOptimize();
  }, []);

  const handleOptimize = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.optimizeCounters({
        predicted_demand: parseFloat(demandInput),
        date: selectedDate,
        time_slot: selectedSlot,
        available_staff: parseInt(availableStaff),
        max_counters: parseInt(maxCounters),
        target_wait_min: parseFloat(targetWaitMin),
        service_rate_per_staff: parseFloat(serviceRate)
      });
      setOptData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Counter & Staff Optimization Engine</h2>
        <p className="text-xs text-slate-500 mt-1">
          Dynamically configures open counters and assigns staff crew members to satisfy target waiting times without exceeding labor constraints.
        </p>
      </div>

      {/* Control Tuning Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <span>Operational Parameters & Constraints</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Demand Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">Projected Demand</label>
              <span className="text-xs font-extrabold text-emerald-700">{demandInput} orders</span>
            </div>
            <input
              type="range"
              min="10"
              max="140"
              step="5"
              value={demandInput}
              onChange={(e) => setDemandInput(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>10 (Off-Peak)</span>
              <span>75 (Lunch Rush)</span>
              <span>140 (Extreme)</span>
            </div>
          </div>

          {/* 2. Available Staff Pool */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">Available Staff Crew</label>
              <span className="text-xs font-extrabold text-teal-700">{availableStaff} staff</span>
            </div>
            <input
              type="range"
              min="2"
              max="12"
              step="1"
              value={availableStaff}
              onChange={(e) => setAvailableStaff(e.target.value)}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>2 (Minimal)</span>
              <span>8 (Normal)</span>
              <span>12 (Surge Pool)</span>
            </div>
          </div>

          {/* 3. Target Waiting Time */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">Target Wait Time</label>
              <span className="text-xs font-extrabold text-indigo-700">{targetWaitMin} min</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.5"
              value={targetWaitMin}
              onChange={(e) => setTargetWaitMin(e.target.value)}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1.0m (Strict)</span>
              <span>3.0m (Standard)</span>
              <span>8.0m (Relaxed)</span>
            </div>
          </div>

          {/* 4. Service Rate Assumption */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700">Service Rate / Staff</label>
              <span className="text-xs font-extrabold text-amber-700">{serviceRate} orders / 15m</span>
            </div>
            <input
              type="range"
              min="8.0"
              max="25.0"
              step="1"
              value={serviceRate}
              onChange={(e) => setServiceRate(e.target.value)}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>8 (~1 per 2m)</span>
              <span>15 (~1 per 1m)</span>
              <span>25 (Fast Food)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs text-slate-600">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Time Slot (All 15-Min Slots)</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
              >
                {ALL_COLLEGE_TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Target Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
              />
            </div>
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading}
            className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Optimizing...' : 'Calculate Optimal Allocation'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* OVERLOAD WARNING BANNER */}
      {optData?.is_overload && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-sm text-rose-900">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold uppercase tracking-wider text-rose-800">
                CAPACITY OVERLOAD WARNING
              </h4>
              <p className="text-xs text-rose-800 font-medium leading-relaxed">
                {optData.overload_warning}
              </p>
              <div className="text-xs text-rose-700 mt-2 font-semibold">
                Emergency Actions: Activate grab-and-go packaging, open dedicated mobile checkout, or reassign kitchen prep staff to service counters.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Demand Analyzed</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{optData?.demand_analyzed || demandInput} orders</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Source: {optData?.demand_source || 'Input'}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Open Counters</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {optData?.open_counters_count || 1} / 5 Active
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Physical counters in service</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Staff Deployed</div>
          <div className="text-2xl font-black text-teal-700 mt-1">
            {optData?.total_staff_allocated || 2} / {availableStaff} Staff
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Without exceeding staff ceiling</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Estimated Wait Time</div>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            ~{optData?.estimated_wait_min || 1.2} min
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Target: {targetWaitMin} min</div>
        </div>
      </div>

      {/* COUNTER CARDS (C1 to C5) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Per-Counter Deployment & Utilization Strategy
          </h3>
          <span className="text-xs text-slate-500">
            Max counter physical capacity: 36 orders / 15m (up to 2 staff each)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {(optData?.counters || []).map((cnt) => {
            const isOpen = cnt.status === 'Open';
            return (
              <div
                key={cnt.counter_id}
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  isOpen
                    ? 'border-emerald-300 shadow-sm ring-1 ring-emerald-200/50'
                    : 'border-slate-200 opacity-75 bg-slate-50/50'
                }`}
              >
                {/* Counter Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-base font-extrabold text-slate-900">{cnt.counter_id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cnt.status}
                  </span>
                </div>

                {/* Metrics */}
                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between text-slate-600">
                    <span>Staff on Duty:</span>
                    <span className="font-bold text-slate-800">{cnt.staff_allocated} crew</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Service Capacity:</span>
                    <span className="font-semibold text-slate-800">{cnt.expected_capacity} orders</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Est. Queue Length:</span>
                    <span className="font-semibold text-slate-800">{cnt.queue_length_est} students</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Avg. Wait:</span>
                    <span className="font-semibold text-slate-800">{cnt.avg_wait_min_est} min</span>
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Utilization</span>
                    <span className={cnt.expected_utilization_pct > 85 ? 'text-amber-600 font-bold' : ''}>
                      {cnt.expected_utilization_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        cnt.expected_utilization_pct > 90 ? 'bg-rose-500' :
                        cnt.expected_utilization_pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, cnt.expected_utilization_pct)}%` }}
                    />
                  </div>
                </div>

                {/* Reason Pill */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug">
                  {cnt.reason}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actionable Directives Strip */}
      {optData?.action_recommendations && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Operational Supervisor Action Directives</span>
          </h4>
          <ul className="space-y-2">
            {optData.action_recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
