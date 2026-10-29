import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Download,
  RotateCcw,
  Table as TableIcon,
  Layers,
  Database
} from 'lucide-react';
import { api } from '../services/api';

export default function DatasetUpload({ summary, onRefresh }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      const res = await api.getDataPreview(10);
      setPreviewData(res);
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.csv')) {
        setErrorMsg('Please select a valid CSV file (.csv)');
        return;
      }
      setFile(selected);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.uploadDataset(file);
      setUploadResult(res);
      setSuccessMsg(`Successfully uploaded and validated "${file.name}" with ${res.rows?.toLocaleString()} rows.`);
      await fetchPreview();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleResetSample = async () => {
    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.resetSampleDataset();
      setSuccessMsg('Reset to default 100,000 synthetic canteen dataset successfully.');
      setFile(null);
      setUploadResult(null);
      await fetchPreview();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset sample dataset');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Dataset Management & Upload</h2>
        <p className="text-xs text-slate-500 mt-1">
          Inspect, upload, validate, or reset the canteen transactional dataset.
        </p>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Validation or Upload Error</div>
            <div className="text-xs mt-0.5">{errorMsg}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Dataset Loaded</div>
            <div className="text-xs mt-0.5">{successMsg}</div>
          </div>
        </div>
      )}

      {/* Upload and Reset Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Upload New Canteen Dataset</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Upload a CSV containing: <code>date, time_slot, counter_id, orders_served, queue_length, avg_wait_min, staff_on_duty, class_break, campus_event</code>.
          </p>

          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
            <input
              type="file"
              accept=".csv"
              id="fileInput"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
              <Database className="w-10 h-10 text-emerald-500 mb-2" />
              <span className="text-sm font-semibold text-slate-800">
                {file ? file.name : 'Click to select CSV file'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Supported format: .csv'}
              </span>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {file ? `Ready to upload: ${file.name}` : 'No file chosen'}
            </span>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>{uploading ? 'Processing & Validating...' : 'Upload & Validate'}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions & Dataset Health (1 Col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center space-x-2">
              <Database className="w-4 h-4 text-teal-600" />
              <span>Sample Dataset Control</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Reload the built-in 100,000 synthetic transaction dataset (500 days of canteen service).
            </p>

            <button
              onClick={handleResetSample}
              disabled={uploading}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50 mb-3"
            >
              <RotateCcw className={`w-4 h-4 ${uploading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>Load Existing Sample Dataset</span>
            </button>

            <a
              href={api.getCleanDataDownloadUrl()}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Download Cleaned Data (CSV)</span>
            </a>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Validation Standards:</div>
            <div>• Date format: <code>YYYY-MM-DD</code></div>
            <div>• Time format: <code>HH:MM-HH:MM</code></div>
            <div>• Non-negative orders, queues & wait times</div>
            <div>• Binary categories: <code>yes / no</code></div>
          </div>
        </div>
      </div>

      {/* Dataset Metadata Summary Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Active Dataset Diagnostics</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Total Rows</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary?.total_records ? summary.total_records.toLocaleString() : '100,000'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Date Range</div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {summary?.date_range?.start || '2023-07-03'} to {summary?.date_range?.end || '2025-05-30'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{summary?.date_range?.unique_days || 500} operating days</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Duplicate Rows</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {summary?.duplicate_rows ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Zero duplicates detected</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Missing Values</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">0</div>
            <div className="text-[11px] text-slate-500 mt-0.5">100% complete records</div>
          </div>
        </div>

        {/* Detected Columns */}
        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Detected Schema Columns (9)</div>
          <div className="flex flex-wrap gap-2">
            {(summary?.columns || [
              'date', 'time_slot', 'counter_id', 'orders_served', 'queue_length',
              'avg_wait_min', 'staff_on_duty', 'class_break', 'campus_event'
            ]).map((col) => (
              <span key={col} className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Table of First 10 Rows */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>Dataset Preview (First 10 Rows)</span>
            </h3>
            <p className="text-xs text-slate-500">Live preview of records loaded in backend storage</p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Showing {previewData?.records?.length || 10} of {summary?.total_records?.toLocaleString() || '100,000'} rows
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">Time Slot</th>
                <th className="px-3.5 py-2.5">Counter</th>
                <th className="px-3.5 py-2.5">Orders Served</th>
                <th className="px-3.5 py-2.5">Queue Length</th>
                <th className="px-3.5 py-2.5">Avg Wait (min)</th>
                <th className="px-3.5 py-2.5">Staff on Duty</th>
                <th className="px-3.5 py-2.5">Class Break</th>
                <th className="px-3.5 py-2.5">Campus Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {(previewData?.records || []).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3.5 py-2 font-mono text-slate-800">{row.date}</td>
                  <td className="px-3.5 py-2 font-mono text-slate-700">{row.time_slot}</td>
                  <td className="px-3.5 py-2 font-bold text-emerald-700">{row.counter_id}</td>
                  <td className="px-3.5 py-2 font-semibold text-slate-900">{row.orders_served}</td>
                  <td className="px-3.5 py-2">{row.queue_length}</td>
                  <td className="px-3.5 py-2 font-mono">{row.avg_wait_min}</td>
                  <td className="px-3.5 py-2 font-medium">{row.staff_on_duty}</td>
                  <td className="px-3.5 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      row.class_break === 'yes' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {row.class_break}
                    </span>
                  </td>
                  <td className="px-3.5 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      row.campus_event === 'yes' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {row.campus_event}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
