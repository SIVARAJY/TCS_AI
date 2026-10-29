import React from 'react';
import {
  LayoutDashboard,
  Database,
  TrendingUp,
  Sliders,
  Flame,
  LineChart,
  FileSpreadsheet,
  Coffee,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, health }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dataset', label: 'Dataset & Upload', icon: Database },
    { id: 'prediction', label: 'Footfall Prediction', icon: TrendingUp },
    { id: 'optimization', label: 'Counter Optimization', icon: Sliders },
    { id: 'peakhour', label: 'Peak-Hour Plan', icon: Flame },
    { id: 'performance', label: 'Model Performance', icon: LineChart },
    { id: 'reports', label: 'Export Reports', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shadow-sm z-20">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center space-x-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
          <Coffee className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight leading-tight">Canteen AI</h1>
          <p className="text-xs text-emerald-100 font-medium">Queue & Counter Planner</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/60 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status Footprint */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System Status</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Backend API</span>
            </span>
            <span className="font-medium text-emerald-700">{health?.status || 'Connecting...'}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>ML Model</span>
            <span className={`font-medium ${health?.model_loaded ? 'text-emerald-700' : 'text-amber-600'}`}>
              {health?.model_loaded ? 'RandomForest' : 'Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>Dataset</span>
            <span className="font-medium text-slate-800">
              {health?.total_records ? `${(health.total_records / 1000).toFixed(0)}k rows` : '0 rows'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
