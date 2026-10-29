import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  Calendar,
  Sparkles,
  Sliders,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function PeakHourPlan() {
  const [date, setDate] = useState('2025-05-30');
  const [classBreak, setClassBreak] = useState('yes');
  const [campusEvent, setCampusEvent] = useState('no');
  const [availableStaff, setAvailableStaff] = useState(8);
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    fetchPlan();
  }, [date, classBreak, campusEvent, availableStaff]);

  const fetchPlan = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getPeakHourPlan(date, classBreak, campusEvent, availableStaff);
      setPlanData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate peak hour plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Peak-Hour Operational Action Plan</h2>
        <p className="text-xs text-slate-500 mt-1">
          Automated schedule directives for canteen supervisors during heavy footfall lunch breaks and snack surges.
        </p>
      </div>

      {/* Control bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Class Break</label>
            <select
              value={classBreak}
              onChange={(e) => setClassBreak(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800"
            >
              <option value="yes">Break: Yes (+Surge)</option>
              <option value="no">Break: No</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Campus Event</label>
            <select
              value={campusEvent}
              onChange={(e) => setCampusEvent(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800"
            >
              <option value="no">Event: No</option>
              <option value="yes">Event: Yes</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Available Crew</label>
            <select
              value={availableStaff}
              onChange={(e) => setAvailableStaff(parseInt(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800"
            >
              <option value="5">5 Staff (Constrained)</option>
              <option value="8">8 Staff (Standard)</option>
              <option value="10">10 Staff (Full Crew)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>{planData?.total_peak_slots || 0} Peak Windows Identified</span>
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Plan Card Deck */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-sm">
            Evaluating peak-hour footfall and generating operational plans...
          </div>
        ) : planData?.items?.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 text-sm">
            No severe peak slots detected for this date and configuration. Operations can run with standard baseline staffing.
          </div>
        ) : (
          planData?.items?.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-300 shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      Time Interval: {item.time_slot}
                    </div>
                    <div className="text-xs text-slate-500">
                      Projected Demand: <span className="font-bold text-slate-800">{item.projected_demand} orders</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    item.demand_level === 'Surge' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.demand_level} Demand
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {item.recommended_open_counters} Counters Open
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                    {item.recommended_staff} Staff
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Action Directives */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center space-x-1.5 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Operational Directive:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {item.action}
                  </p>
                </div>

                {/* Expected Outcome */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <div className="font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center space-x-1.5 text-[11px]">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Expected Performance Outcome:</span>
                  </div>
                  <p className="text-emerald-900 leading-relaxed font-medium">
                    {item.expected_outcome}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
