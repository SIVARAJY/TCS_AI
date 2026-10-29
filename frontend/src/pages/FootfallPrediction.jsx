import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '../services/api';
import { ALL_COLLEGE_TIME_SLOTS } from '../constants/timeSlots';

export default function FootfallPrediction() {
  const [date, setDate] = useState('2025-05-30');
  const [timeSlot, setTimeSlot] = useState('12:00-12:15');
  const [classBreak, setClassBreak] = useState('yes');
  const [campusEvent, setCampusEvent] = useState('no');
  const [horizon, setHorizon] = useState(8); // default next 2 hours (8 slots)
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [metaInfo, setMetaInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    handleRunPrediction();
  }, []);

  const handleRunPrediction = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.predictDemand({
        date,
        time_slot: timeSlot,
        class_break: classBreak,
        campus_event: campusEvent,
        horizon_slots: parseInt(horizon)
      });
      setResults(data.slots || []);
      setMetaInfo({
        generated_at: data.generated_at,
        model_used: data.model_used,
        date: data.date
      });
    } catch (err) {
      setErrorMsg(err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data: Predicted vs Actual vs Historical Avg
  const chartData = results.map((item) => ({
    timeSlot: item.time_slot.split('-')[0],
    fullSlot: item.time_slot,
    predicted: item.predicted_demand,
    actual: item.actual_demand !== null ? item.actual_demand : undefined,
    historicalAvg: item.historical_avg
  }));

  const hasActuals = results.some((r) => r.actual_demand !== null && r.actual_demand !== undefined);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Footfall & Demand Forecasting</h2>
        <p className="text-xs text-slate-500 mt-1">
          Predict canteen order volume per 15-minute slot using trained RandomForestRegressor with chronological autoregressive lag rolling.
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Date</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Dates up to 2025-05-30 have actuals</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Start Slot (Every 15 Min)</span>
            </label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ALL_COLLEGE_TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Full day: 08:00 to 18:00 every 15 min</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Class Break Status
            </label>
            <select
              value={classBreak}
              onChange={(e) => setClassBreak(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="yes">Class Break: Yes (+Surge)</option>
              <option value="no">Class Break: No (Regular)</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Directly impacts student arrivals</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Campus Event Status
            </label>
            <select
              value={campusEvent}
              onChange={(e) => setCampusEvent(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="no">Campus Event: No</option>
              <option value="yes">Campus Event: Yes (Extra Footfall)</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Seminar / sports meet boost</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Forecast Horizon
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="1">1 Slot (15 mins)</option>
              <option value="4">4 Slots (1 hour)</option>
              <option value="8">8 Slots (2 hours)</option>
              <option value="16">16 Slots (4 hours)</option>
              <option value="40">Full Day (40 slots, 8am-6pm)</option>
            </select>
            <div className="mt-2">
              <button
                onClick={handleRunPrediction}
                disabled={loading}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? 'Forecasting...' : 'Run Forecast'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Chart: Predicted vs Actual vs Historical Avg */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Demand Forecast Trajectory: Predicted vs Actual Orders
            </h3>
            <p className="text-xs text-slate-500">
              {hasActuals
                ? 'Comparing model predictions directly against recorded ground truth for this date.'
                : 'Showing predicted demand against slot historical baseline averages.'}
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
              <span className="w-3 h-0.5 bg-emerald-600"></span>
              <span>Predicted</span>
            </span>
            {hasActuals && (
              <span className="flex items-center space-x-1 text-indigo-700 font-semibold">
                <span className="w-3 h-0.5 bg-indigo-600"></span>
                <span>Actual Ground Truth</span>
              </span>
            )}
            <span className="flex items-center space-x-1 text-slate-500 font-medium">
              <span className="w-3 h-0.5 bg-slate-400 border-dashed"></span>
              <span>Historical Avg</span>
            </span>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="timeSlot" tick={{ fontSize: 11, fill: '#64748b' }} interval={horizon > 16 ? 3 : 0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(val, name) => [
                  `${val} orders`,
                  name === 'predicted' ? 'Predicted Demand' :
                  name === 'actual' ? 'Actual Ground Truth' : 'Historical Slot Avg'
                ]}
                labelFormatter={(lbl, p) => p?.[0]?.payload?.fullSlot || lbl}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#059669"
                strokeWidth={3}
                dot={{ r: 3, fill: '#059669' }}
                activeDot={{ r: 6 }}
              />
              {hasActuals && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2.5, fill: '#4f46e5' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="historicalAvg"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prediction Results Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Detailed 15-Minute Slot Predictions & Operational Sizing
            </h3>
            <p className="text-xs text-slate-500">
              Generated by {metaInfo?.model_used || 'RandomForestRegressor'} at {metaInfo?.generated_at || 'Just now'}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            {results.length} Slot Horizon
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Time Slot</th>
                <th className="px-3.5 py-2.5">Predicted Demand</th>
                <th className="px-3.5 py-2.5">Actual (if in dataset)</th>
                <th className="px-3.5 py-2.5">Demand Category</th>
                <th className="px-3.5 py-2.5">Queue Risk</th>
                <th className="px-3.5 py-2.5">Recommended Counters</th>
                <th className="px-3.5 py-2.5">Operational Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {results.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800">{row.time_slot}</td>
                  <td className="px-3.5 py-2.5 font-extrabold text-slate-900 text-sm">
                    {row.predicted_demand} orders
                  </td>
                  <td className="px-3.5 py-2.5 font-semibold text-indigo-700">
                    {row.actual_demand !== null ? `${row.actual_demand} orders` : '—'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      row.demand_category === 'Surge' ? 'bg-rose-100 text-rose-800' :
                      row.demand_category === 'High' ? 'bg-amber-100 text-amber-800' :
                      row.demand_category === 'Moderate' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {row.demand_category}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      row.predicted_queue_risk === 'Critical' ? 'bg-rose-100 text-rose-800' :
                      row.predicted_queue_risk === 'High' ? 'bg-amber-100 text-amber-800' :
                      row.predicted_queue_risk === 'Moderate' ? 'bg-blue-100 text-blue-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {row.predicted_queue_risk}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 font-bold text-emerald-700">
                    {row.recommended_counters} / 5 Counters
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-500">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
