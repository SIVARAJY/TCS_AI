const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/api/health`);
    return handleResponse(res);
  },

  // Dataset
  getDataSummary: async () => {
    const res = await fetch(`${API_BASE}/api/data/summary`);
    return handleResponse(res);
  },

  getDataPreview: async (limit = 10) => {
    const res = await fetch(`${API_BASE}/api/data/preview?limit=${limit}`);
    return handleResponse(res);
  },

  uploadDataset: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/data/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  resetSampleDataset: async () => {
    const res = await fetch(`${API_BASE}/api/data/reset-sample`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  getCleanDataDownloadUrl: () => `${API_BASE}/api/data/download-clean`,

  // Prediction
  predictDemand: async (payload) => {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // Optimization
  optimizeCounters: async (payload) => {
    const res = await fetch(`${API_BASE}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // Peak Hour Plan
  getPeakHourPlan: async (date, classBreak = 'no', campusEvent = 'no', availableStaff = 8) => {
    const params = new URLSearchParams({
      date,
      class_break: classBreak,
      campus_event: campusEvent,
      available_staff: availableStaff,
    });
    const res = await fetch(`${API_BASE}/api/reports/peak-plan?${params.toString()}`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  // Model Metrics
  getModelMetrics: async () => {
    const res = await fetch(`${API_BASE}/api/model/metrics`);
    return handleResponse(res);
  },

  getFeatureImportance: async () => {
    const res = await fetch(`${API_BASE}/api/model/feature-importance`);
    return handleResponse(res);
  },

  // CSV Export URLs
  getPredictionsExportUrl: (date, classBreak = 'no', campusEvent = 'no', horizon = 40) => {
    return `${API_BASE}/api/reports/predictions?date=${date}&class_break=${classBreak}&campus_event=${campusEvent}&horizon=${horizon}`;
  },

  getCountersExportUrl: (demand, timeSlot = '12:30-12:45', date = '', availableStaff = 8) => {
    return `${API_BASE}/api/reports/counters?demand=${demand}&time_slot=${timeSlot}&date=${date}&available_staff=${availableStaff}`;
  },

  getActionPlanExportUrl: (date, classBreak = 'no', campusEvent = 'no') => {
    return `${API_BASE}/api/reports/action-plan?date=${date}&class_break=${classBreak}&campus_event=${campusEvent}`;
  },
};
