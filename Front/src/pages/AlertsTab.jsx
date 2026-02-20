import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useSelector } from "react-redux";

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

const SEVERITY_STYLES = {
  high: "bg-red-100 text-red-700 border-red-300",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  low: "bg-gray-100 text-gray-600 border-gray-300",
};

const SEVERITY_BADGE = {
  high: "bg-red-500 text-white",
  medium: "bg-yellow-400 text-white",
  low: "bg-gray-400 text-white",
};

const TYPE_LABEL = {
  inactive: "Inactive",
  high_usage: "High Usage",
  blacklist: "Blacklist",
};

const REFRESH_INTERVAL = 10; // seconds

// Map lab selection → slice indices into the 100-PC array
const LAB_RANGES = {
  All:    [0, 100],
  CSL3:   [0, 50],
  CSL4:   [50, 100],
  "CSL3.1": [0, 25],
  "CSL3.2": [25, 50],
  "CSL4.1": [50, 75],
  "CSL4.2": [75, 100],
};

const AlertsTab = ({ onAlertCount, selectedLab = "All" }) => {
  // Pull all PCs directly from Redux
  const allPCs = useSelector((state) => state.pcs.pcs);

  const [rawAlerts, setRawAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(null);

  // Derive the allowed MACs for the current lab section directly from Redux
  const allowedMacs = useMemo(() => {
    const [start, end] = LAB_RANGES[selectedLab] ?? [0, 100];
    const sectionPCs = allPCs.slice(start, end);
    const macs = sectionPCs
      .map((pc) => pc.mac)
      .filter((mac) => mac && mac !== "00:00:00:00:00:00");
    return new Set(macs);
  }, [allPCs, selectedLab]);

  // Fetch all alerts from API — store raw, filter reactively
  const fetchAlerts = async () => {
    setError("");
    try {
      const res = await axios.get("http://127.0.0.1:5000/alerts");
      setRawAlerts(res.data.alerts || []);
    } catch (err) {
      setError("Failed to fetch alerts. Is the server running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh timer
  useEffect(() => {
    fetchAlerts();

    const refreshTimer = setInterval(() => {
      fetchAlerts();
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownRef.current);
    };
  }, []);

  // Filter raw alerts to current lab section + sort high → low
  const labAlerts = useMemo(() => {
    let scoped;
    if (selectedLab === "All") {
      // Show all alerts when viewing all PCs
      scoped = rawAlerts;
    } else {
      // Strictly filter to only MACs assigned in this lab range
      scoped = rawAlerts.filter((a) => allowedMacs.has(a.mac));
    }
    return [...scoped].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    );
  }, [rawAlerts, allowedMacs, selectedLab]);

  // Keep badge count in sync
  useEffect(() => {
    if (onAlertCount) onAlertCount(labAlerts.length);
  }, [labAlerts]);

  const handleManualRefresh = () => {
    fetchAlerts();
    setCountdown(REFRESH_INTERVAL);
  };

  // Apply severity / type UI filters on top of lab-scoped alerts
  const displayedAlerts = labAlerts.filter((alert) => {
    const matchSeverity = filterSeverity === "all" || alert.severity === filterSeverity;
    const matchType = filterType === "all" || alert.type === filterType;
    return matchSeverity && matchType;
  });

  const countBySeverity = (sev) => labAlerts.filter((a) => a.severity === sev).length;

  return (
    <div className="w-full">
      {/* Summary Cards */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{countBySeverity("high")}</div>
          <div className="text-sm text-red-500 mt-1">High Severity</div>
        </div>
        <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-500">{countBySeverity("medium")}</div>
          <div className="text-sm text-yellow-500 mt-1">Medium Severity</div>
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-500">{countBySeverity("low")}</div>
          <div className="text-sm text-gray-400 mt-1">Low Severity</div>
        </div>
        <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{labAlerts.length}</div>
          <div className="text-sm text-blue-400 mt-1">Total Alerts</div>
        </div>
      </div>

      {/* Filters + Refresh */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-2 py-1 rounded-lg border border-gray-300 text-sm"
        >
          <option value="all">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1 rounded-lg border border-gray-300 text-sm"
        >
          <option value="all">All Types</option>
          <option value="inactive">Inactive</option>
          <option value="high_usage">High Usage</option>
          <option value="blacklist">Blacklist</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Refreshing in <span className="font-semibold text-gray-600">{countdown}s</span>
          </span>
          <button
            onClick={handleManualRefresh}
            className="px-4 py-1 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading alerts...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : displayedAlerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No alerts found.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayedAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-4 border rounded-lg px-4 py-3 ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low}`}
            >
              {/* Severity Badge */}
              <span
                className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${SEVERITY_BADGE[alert.severity] || SEVERITY_BADGE.low}`}
              >
                {alert.severity}
              </span>

              {/* Type Badge */}
              <span className="mt-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-white bg-opacity-60 border border-current shrink-0">
                {TYPE_LABEL[alert.type] || alert.type}
              </span>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{alert.message}</div>
                <div className="text-xs mt-0.5 opacity-75 font-mono">{alert.mac}</div>
              </div>

              {/* Extra Details */}
              <div className="text-xs text-right shrink-0 opacity-80">
                {alert.type === "high_usage" && (
                  <>
                    <div>Usage: <span className="font-semibold">{alert.total_usage_MB} MB</span></div>
                    <div>Limit: {alert.limit_MB} MB</div>
                  </>
                )}
                {alert.type === "blacklist" && (
                  <div>Site: <span className="font-semibold">{alert.site}</span></div>
                )}
                {alert.type === "inactive" && (
                  <div>Idle: <span className="font-semibold">{Math.floor(alert.seconds_idle / 60)} min</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsTab;