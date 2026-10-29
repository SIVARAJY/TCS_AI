import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import DatasetUpload from './pages/DatasetUpload';
import FootfallPrediction from './pages/FootfallPrediction';
import CounterOptimization from './pages/CounterOptimization';
import PeakHourPlan from './pages/PeakHourPlan';
import ModelPerformance from './pages/ModelPerformance';
import Reports from './pages/Reports';
import Login from './pages/Login';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('canteen_user') || sessionStorage.getItem('canteen_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [user]);

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [hRes, sRes] = await Promise.all([
        api.getHealth(),
        api.getDataSummary().catch(() => null)
      ]);
      setHealth(hRes);
      setSummary(sRes);
    } catch (err) {
      console.error('Initialization error:', err);
      setErrorMsg(err.message || 'Could not connect to FastAPI backend');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('canteen_user');
    sessionStorage.removeItem('canteen_user');
    setUser(null);
  };

  // If user is not logged in, show the Login Page
  if (!user) {
    return <Login onLogin={(userData) => setUser(userData)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard summary={summary} onNavigate={setActiveTab} />;
      case 'dataset':
        return <DatasetUpload summary={summary} onRefresh={fetchInitialData} />;
      case 'prediction':
        return <FootfallPrediction />;
      case 'optimization':
        return <CounterOptimization />;
      case 'peakhour':
        return <PeakHourPlan />;
      case 'performance':
        return <ModelPerformance />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard summary={summary} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} health={health} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          health={health}
          onRefresh={fetchInitialData}
          loading={loading}
          user={user}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div>
                <strong>Backend Connection Notice:</strong> {errorMsg}.
                Please ensure the FastAPI backend is running.
              </div>
              <button
                onClick={fetchInitialData}
                className="px-3 py-1 rounded-lg bg-amber-200/60 font-semibold hover:bg-amber-200"
              >
                Retry
              </button>
            </div>
          )}

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
