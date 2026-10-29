import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  TrendingUp,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Flame
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { api } from '../services/api';
import { ALL_COLLEGE_TIME_SLOTS } from '../constants/timeSlots';

export default function Dashboard({ summary, onNavigate }) {
  const [selectedSlot, setSelectedSlot] = useState('12:30-12:45');
  const [selectedDate, setSelectedDate] = useState('2025-05-30');
  const [classBreak, setClassBreak] = useState('yes');
  const [campusEvent, setCampusEvent] = useState('no');
  const [prediction, setPrediction] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [loadingPred, setLoadingPred] = useState(false);

  // Fetch forecast whenever parameters change
  useEffect(() => {
    fetchQuickForecast();
  }, [selectedSlot, selectedDate, classBreak, campusEvent]);

  const fetchQuickForecast = async () => {
    setLoadingPred(true);
    try {
      const predRes = await api.predictDemand({
        date: selectedDate,
        time_slot: selectedSlot,
        class_break: classBreak,
        campus_event: campusEvent,
        horizon_slots: 1
      });
      if (predRes.slots && predRes.slots.length > 0) {
        const slotItem = predRes.slots[0];
        setPrediction(slotItem);

        // Fetch corresponding counter optimization
        const optRes = await api.optimizeCounters({
          predicted_demand: slotItem.predicted_demand,
          date: selectedDate,
          time_slot: selectedSlot,
          available_staff: 8,
          max_counters: 5
        });
        setOptimization(optRes);
      }
    } catch (err) {
      console.error('Failed to fetch forecast:', err);
    } finally {
      setLoadingPred(false);
    }
  };

  // Prepare hourly distribution for chart
  const hourlyData = summary?.hourly_distribution?.map((item) => ({
    slot: item.time_slot.split('-')[0],
    fullSlot: item.time_slot,
    avgDemand: item.avg_demand,
    maxDemand: item.max_demand,
    category: item.peak_category
  })) || [];

  // Prepare counter breakdown data
  const counterData = summary?.counter_stats?.map((c) => ({
    name: c.counter_id,
    orders: c.total_orders,
    avgSlot: c.avg_orders_per_slot,
    wait: c.avg_wait_min
  })) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Driven Demand Forecasting & Counter Optimization</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Canteen Queue & Staff Allocation Engine
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Eliminate peak-hour bottleneck lines by anticipating footfall surges 15 minutes in advance.
            Optimizes counter openings and balances crew staffing dynamically using historical transaction patterns.
          </p>
        </div>
      </div>

      {/* SECTION 1: HISTORICAL DATASET BENCHMARK METRICS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span>Historical Baseline Metrics</span>
            </h3>
            <p className="text-xs text-slate-500">Aggregate statistics computed from the 100,000 canteen transaction records</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            Historical Data
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Records Loaded</span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.total_records ? summary.total_records.toLocaleString() : '100,000'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {summary?.total_aggregate_slots ? `${summary.total_aggregate_slots.toLocaleString()} aggregate slots` : '20,000 slots'} across 500 days
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Historical Orders Served</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.total_historical_orders ? summary.total_historical_orders.toLocaleString() : '695,988'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Demand proxy across Counters C1–C5
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Historical Queue</span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.avg_queue_length !== undefined ? `${summary.avg_queue_length} students` : '0.8 students'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Average line length per counter slot
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Waiting Time</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.avg_wait_min !== undefined ? `${summary.avg_wait_min} min` : '0.5 min'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Across all peak and off-peak periods
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: REAL-TIME AI PREDICTION & COUNTER OPTIMIZATION */}
      <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white rounded-2xl p-6 border-2 border-emerald-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-emerald-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-600 text-white mb-1.5">
              <Sparkles className="w-3 h-3" />
              <span>LIVE AI FORECAST</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Slot Footfall Prediction & Staff Recommendation
            </h3>
            <p className="text-xs text-slate-600">
              Calculated dynamically via Machine Learning using time slot, break surges, and past lags.
            </p>
          </div>

          {/* Slot Selector Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Time Slot</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 shadow-sm max-w-[210px]"
              >
                {ALL_COLLEGE_TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Class Break</label>
              <select
                value={classBreak}
                onChange={(e) => setClassBreak(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 shadow-sm"
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
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 shadow-sm"
              >
                <option value="no">Event: No</option>
                <option value="yes">Event: Yes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Prediction Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Predicted Demand */}
          <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Predicted Demand</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                prediction?.demand_category === 'Surge' ? 'bg-rose-100 text-rose-700' :
                prediction?.demand_category === 'High' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {prediction?.demand_category || 'Predicting...'}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              {loadingPred ? '...' : `${prediction?.predicted_demand || 0} orders`}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
              <span>Historical Avg for Slot:</span>
              <span className="font-semibold text-slate-700">{prediction?.historical_avg || '—'} orders</span>
            </div>
          </div>

          {/* 2. Recommended Open Counters */}
          <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Open Counters Needed</span>
              <Sliders className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-700">
              {loadingPred ? '...' : `${optimization?.open_counters_count || 1} / 5 Open`}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {optimization?.counters?.filter(c => c.status === 'Open').map(c => c.counter_id).join(', ') || 'C1'} active
            </div>
          </div>

          {/* 3. Recommended Staff */}
          <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Staff Allocated</span>
              <Users className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-extrabold text-teal-700">
              {loadingPred ? '...' : `${optimization?.total_staff_allocated || 2} Staff`}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Available pool: {optimization?.total_available_staff || 8} crew members
            </div>
          </div>

          {/* 4. Peak Demand & Wait Status */}
          <div className={`bg-white rounded-xl p-5 border shadow-sm ${
            optimization?.is_overload ? 'border-rose-300 bg-rose-50/40' : 'border-emerald-200'
          }`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Expected Queue Status</span>
              {optimization?.is_overload ? (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {loadingPred ? '...' : `~${optimization?.estimated_wait_min || 1.2} min wait`}
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Utilization: <span className="font-semibold">{optimization?.overall_utilization_pct || 0}%</span>
              {optimization?.is_overload && <span className="text-rose-600 font-bold ml-1">(Overload Risk)</span>}
            </div>
          </div>
        </div>

        {/* Operational Note banner */}
        {optimization?.action_recommendations && (
          <div className="mt-4 p-3.5 rounded-xl bg-white/90 border border-emerald-200 text-xs text-slate-700 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Operational Recommendation for {selectedSlot}: </span>
              {optimization.action_recommendations[0]}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: VISUAL INTELLIGENCE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Demand Profile (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Canteen Demand Profile Across Operating Hours</h4>
              <p className="text-xs text-slate-500">Average historical orders served in each 15-minute slot (08:00 - 18:00)</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center space-x-1 text-emerald-700 font-medium">
                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                <span>Avg Orders</span>
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="slot" tick={{ fontSize: 11, fill: '#64748b' }} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => [`${value} orders`, 'Average Demand']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullSlot || label}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="avgDemand" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#demandGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Counter Load Breakdown (1 Col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">Counter Throughput Distribution</h4>
            <p className="text-xs text-slate-500">Total historical orders handled per counter</p>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={counterData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => [`${value.toLocaleString()} orders`, 'Total Served']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="orders" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('prediction')}
          className="text-left bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Footfall Predictor</h4>
          <p className="text-xs text-slate-500 mt-1">Simulate multi-slot break schedules and test event footfall scenarios.</p>
        </button>

        <button
          onClick={() => onNavigate('optimization')}
          className="text-left bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Sliders className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Counter Optimization</h4>
          <p className="text-xs text-slate-500 mt-1">Adjust crew capacity, target wait times, and inspect individual counter reasons.</p>
        </button>

        <button
          onClick={() => onNavigate('peakhour')}
          className="text-left bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Flame className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Peak-Hour Action Plan</h4>
          <p className="text-xs text-slate-500 mt-1">Generate immediate step-by-step operational directives for canteen supervisors.</p>
        </button>
      </div>
    </div>
  );
}
