import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useSelector } from "react-redux";

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

const TYPE_LABEL = {
  inactive:   "Inactive",
  high_usage: "High Usage",
  blacklist:  "Blacklist",
};

const REFRESH_INTERVAL = 10;

const LAB_RANGES = {
  All:      [0, 100],
  CSL3:     [0, 50],
  CSL4:     [50, 100],
  "CSL3.1": [0, 25],
  "CSL3.2": [25, 50],
  "CSL4.1": [50, 75],
  "CSL4.2": [75, 100],
};

const SEVERITY_COLOR = {
  high:   { bg: "#ff4f6a22", border: "#ff4f6a55", badge: "#ff4f6a", text: "#ff4f6a" },
  medium: { bg: "#ffaa0022", border: "#ffaa0055", badge: "#ffaa00", text: "#ffaa00" },
  low:    { bg: "#4a558022", border: "#4a558055", badge: "#4a5580", text: "#4a5580" },
};

const AlertsTab = ({ onAlertCount, selectedLab = "All" }) => {
  const allPCs = useSelector((state) => state.pcs.pcs);

  const [rawAlerts,     setRawAlerts]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [filterSeverity,setFilterSeverity]= useState("all");
  const [filterType,    setFilterType]    = useState("all");
  const [countdown,     setCountdown]     = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(null);

  const allowedMacs = useMemo(() => {
    const [start, end] = LAB_RANGES[selectedLab] ?? [0, 100];
    const macs = allPCs.slice(start, end)
      .map((pc) => pc.mac)
      .filter((mac) => mac && mac !== "00:00:00:00:00:00");
    return new Set(macs);
  }, [allPCs, selectedLab]);

  const fetchAlerts = async () => {
    setError("");
    try {
      const res = await axios.get("http://127.0.0.1:5000/alerts");
      setRawAlerts(res.data.alerts || []);
    } catch (err) {
      setError("Failed to fetch alerts — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const refresh = setInterval(() => {
      fetchAlerts();
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((p) => (p <= 1 ? REFRESH_INTERVAL : p - 1));
    }, 1000);
    return () => { clearInterval(refresh); clearInterval(countdownRef.current); };
  }, []);

  const labAlerts = useMemo(() => {
    const scoped = selectedLab === "All"
      ? rawAlerts
      : rawAlerts.filter((a) => allowedMacs.has(a.mac));
    return [...scoped].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    );
  }, [rawAlerts, allowedMacs, selectedLab]);

  useEffect(() => {
    if (onAlertCount) onAlertCount(labAlerts.length);
  }, [labAlerts]);

  const displayedAlerts = labAlerts.filter((alert) => {
    const ms = filterSeverity === "all" || alert.severity === filterSeverity;
    const mt = filterType     === "all" || alert.type     === filterType;
    return ms && mt;
  });

  const countBySeverity = (sev) => labAlerts.filter((a) => a.severity === sev).length;

  const mono = "'JetBrains Mono', monospace";

  return (
    <div style={{ fontFamily: mono, color: "#e2e8f0" }}>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "High",   count: countBySeverity("high"),   color: "#ff4f6a" },
          { label: "Medium", count: countBySeverity("medium"), color: "#ffaa00" },
          { label: "Low",    count: countBySeverity("low"),    color: "#4a5580" },
          { label: "Total",  count: labAlerts.length,          color: "#00c2ff" },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            background: "#0e1221", border: `1px solid ${color}44`,
            borderRadius: "10px", padding: "16px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color }}>{count}</div>
            <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px" }}>
              {label} Severity
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + refresh ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        background: "#0e1221", border: "1px solid #1e2540",
        borderRadius: "8px", padding: "10px 16px", marginBottom: "16px",
      }}>
        {[
          {
            value: filterSeverity, onChange: setFilterSeverity,
            options: [
              { value: "all",    label: "All Severities" },
              { value: "high",   label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low",    label: "Low" },
            ]
          },
          {
            value: filterType, onChange: setFilterType,
            options: [
              { value: "all",        label: "All Types" },
              { value: "inactive",   label: "Inactive" },
              { value: "high_usage", label: "High Usage" },
              { value: "blacklist",  label: "Blacklist" },
            ]
          },
        ].map((sel, i) => (
          <select
            key={i}
            value={sel.value}
            onChange={(e) => sel.onChange(e.target.value)}
            style={{
              padding: "6px 12px", borderRadius: "6px",
              background: "#141828", border: "1px solid #1e2540",
              color: "#e2e8f0", fontFamily: mono, fontSize: "12px", cursor: "pointer",
            }}
          >
            {sel.options.map((o) => (
              <option key={o.value} value={o.value} style={{ background: "#141828" }}>{o.label}</option>
            ))}
          </select>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "11px", color: "#4a5580" }}>
            Refresh in <span style={{ color: "#00c2ff", fontWeight: 600 }}>{countdown}s</span>
          </span>
          <button
            onClick={() => { fetchAlerts(); setCountdown(REFRESH_INTERVAL); }}
            style={{
              padding: "6px 14px", borderRadius: "6px", border: "none",
              background: "#00c2ff22", color: "#00c2ff",
              fontFamily: mono, fontSize: "12px", fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.06em",
            }}
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* ── Alert list ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#4a5580", fontSize: "13px" }}>
          Loading alerts...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#ff4f6a", fontSize: "13px" }}>
          {error}
        </div>
      ) : displayedAlerts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#4a5580", fontSize: "13px" }}>
          No alerts found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {displayedAlerts.map((alert, idx) => {
            const s = SEVERITY_COLOR[alert.severity] ?? SEVERITY_COLOR.low;
            return (
              <div key={idx} style={{
                display: "flex", alignItems: "flex-start", gap: "12px",
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: "8px", padding: "12px 16px",
              }}>

                {/* Severity badge */}
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "3px 10px",
                  borderRadius: "20px", background: s.badge, color: "#080b14",
                  textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0,
                  marginTop: "1px",
                }}>
                  {alert.severity}
                </span>

                {/* Type badge */}
                <span style={{
                  fontSize: "10px", fontWeight: 600, padding: "3px 10px",
                  borderRadius: "20px", background: "#14182844", color: s.text,
                  border: `1px solid ${s.border}`, textTransform: "uppercase",
                  letterSpacing: "0.08em", flexShrink: 0, marginTop: "1px",
                }}>
                  {TYPE_LABEL[alert.type] || alert.type}
                </span>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: "11px", color: "#4a5580", marginTop: "3px" }}>
                    {alert.hostname && (
                      <span style={{ color: "#00c2ff", marginRight: "10px" }}>
                        {alert.hostname}
                      </span>
                    )}
                    {alert.username && (
                      <span style={{ color: "#00ffb2", marginRight: "10px" }}>
                        👤 {alert.username}
                      </span>
                    )}
                    <span style={{ fontFamily: mono }}>{alert.mac}</span>
                  </div>
                </div>

                {/* Extra detail */}
                <div style={{ fontSize: "11px", textAlign: "right", flexShrink: 0, color: "#4a5580" }}>
                  {alert.type === "high_usage" && (
                    <>
                      <div>Usage: <span style={{ color: s.text, fontWeight: 600 }}>{alert.total_usage_MB} MB</span></div>
                      <div>Limit: {alert.limit_MB} MB</div>
                    </>
                  )}
                  {alert.type === "blacklist" && (
                    <div>Site: <span style={{ color: s.text, fontWeight: 600 }}>{alert.site}</span></div>
                  )}
                  {alert.type === "inactive" && (
                    <div>Idle: <span style={{ color: s.text, fontWeight: 600 }}>
                      {Math.floor(alert.seconds_idle / 60)}m {alert.seconds_idle % 60}s
                    </span></div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertsTab;