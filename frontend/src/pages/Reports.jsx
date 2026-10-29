import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Flame,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { ALL_COLLEGE_TIME_SLOTS } from '../constants/timeSlots';

export default function Reports() {
  const [reportDate, setReportDate] = useState('2025-05-30');
  const [classBreak, setClassBreak] = useState('yes');
  const [campusEvent, setCampusEvent] = useState('no');
  const [demandParam, setDemandParam] = useState(75.0);
  const [timeSlotParam, setTimeSlotParam] = useState('12:30-12:45');
  const [staffParam, setStaffParam] = useState(8);

  const timestamp = new Date().toLocaleString();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Executive Reports & Data Export</h2>
        <p className="text-xs text-slate-500 mt-1">
          Generate and download CSV reports for canteen operations, auditing, and college demonstration records.
        </p>
      </div>

      {/* Generation Timestamp Header */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Report Generation System Timestamp: <strong>{timestamp}</strong></span>
        </div>
        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
          Format: RFC-4180 CSV
        </span>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Report 1: Predictions */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 w-fit rounded-xl bg-emerald-50 text-emerald-700 mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Footfall Predictions Export</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Full 40-slot day forecast including predicted demand, queue risk level, recommended counter count, and ground truth comparison.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                />
              </div>
            </div>
          </div>

          <a
            href={api.getPredictionsExportUrl(reportDate, classBreak, campusEvent, 40)}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Predictions (CSV)</span>
          </a>
        </div>

        {/* Report 2: Counter Recommendations */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 w-fit rounded-xl bg-teal-50 text-teal-700 mb-3">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Counter Optimization Export</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Per-counter status (Open/Closed), crew allocation, capacity limits, estimated queue lengths, and transparent reasoning.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Analyzed Demand (Orders)</label>
                <input
                  type="number"
                  value={demandParam}
                  onChange={(e) => setDemandParam(parseFloat(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Time Slot (All 40 Slots)</label>
                <select
                  value={timeSlotParam}
                  onChange={(e) => setTimeSlotParam(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                >
                  {ALL_COLLEGE_TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <a
            href={api.getCountersExportUrl(demandParam, timeSlotParam, reportDate, staffParam)}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Counter Plan (CSV)</span>
          </a>
        </div>

        {/* Report 3: Peak Hour Action Plan */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="p-3 w-fit rounded-xl bg-amber-50 text-amber-700 mb-3">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Peak-Hour Action Plan Export</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Supervisory directives for lunch and snack rushes, detailing immediate operational protocols and expected outcome improvements.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                />
              </div>
            </div>
          </div>

          <a
            href={api.getActionPlanExportUrl(reportDate, classBreak, campusEvent)}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Action Plan (CSV)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
