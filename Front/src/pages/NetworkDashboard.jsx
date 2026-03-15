import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import React from "react";
import axios from "axios";
import PCMonitorTab from "./PCMonitorTab";
import AlertsTab from "./AlertsTab";
import ConfigTab from "./ConfigTab";
import AnalysisTab from "./AnalysisTab";

const TABS = [
  { id: "monitor",  label: "PC Monitor" },
  { id: "alerts",   label: "Alerts" },
  { id: "analysis", label: "Analysis" },
  { id: "config",   label: "Config" },
];

const labOptions = [
  { value: "All",    label: "All: 100 PCs" },
  { value: "CSL3",   label: "CSL3: 1-50 PCs" },
  { value: "CSL4",   label: "CSL4: 51-100" },
  { value: "CSL3.1", label: "CSL3.1: 1-25 PCs" },
  { value: "CSL3.2", label: "CSL3.2: 26-50 PCs" },
  { value: "CSL4.1", label: "CSL4.1: 51-75 PCs" },
  { value: "CSL4.2", label: "CSL4.2: 76-100 PCs" },
];

const NetworkDashboard = () => {
  const [activeTab,   setActiveTab]   = useState("monitor");
  const [alertCount,  setAlertCount]  = useState(0);
  const [agentCount,  setAgentCount]  = useState(0);
  const [isLive,      setIsLive]      = useState(false);
  const [collecting,  setCollecting]  = useState(true);
  const [timer,       setTimer]       = useState(0);
  const [selectedLab, setSelectedLab] = useState("All");
  const [noOfRows,    setNoOfRows]    = useState(4);

  const mockPCs = useSelector((state) => state.pcs.pcs);

  // ── Poll /status + /alerts every 5s ──────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const [statusRes, alertsRes] = await Promise.all([
          axios.get("http://127.0.0.1:5000/status"),
          axios.get("http://127.0.0.1:5000/alerts"),
        ]);
        setAgentCount(statusRes.data.agents       || 0);
        setAlertCount(alertsRes.data.total_alerts || 0);
        setIsLive((statusRes.data.agents || 0) > 0);
        setCollecting(statusRes.data.collecting ?? true);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Timer counts up while live + collecting ───────────────────────────────
  useEffect(() => {
    let id;
    if (isLive && collecting) {
      id = setInterval(() => setTimer((t) => t + 1), 1000);
    } else if (!collecting) {
      setTimer(0);
    }
    return () => clearInterval(id);
  }, [isLive, collecting]);

  // ── Start / Stop toggle ───────────────────────────────────────────────────
  const handleToggle = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/control");
      setCollecting(res.data.collecting);
    } catch (err) {
      console.error("Control error:", err);
    }
  };

  const formatTime = (s) => {
    const h   = String(Math.floor(s / 3600)).padStart(2, "0");
    const m   = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const filteredPCs = useMemo(() => {
    switch (selectedLab) {
      case "CSL3":   return mockPCs.slice(0,  50);
      case "CSL4":   return mockPCs.slice(50, 100);
      case "CSL3.1": return mockPCs.slice(0,  25);
      case "CSL3.2": return mockPCs.slice(25, 50);
      case "CSL4.1": return mockPCs.slice(50, 75);
      case "CSL4.2": return mockPCs.slice(75, 100);
      default:       return mockPCs;
    }
  }, [mockPCs, selectedLab]);

  const handleLabChange = (value) => {
    setSelectedLab(value);
    switch (value) {
      case "CSL3":   case "CSL4":   setNoOfRows(2); break;
      case "CSL3.1": case "CSL3.2":
      case "CSL4.1": case "CSL4.2": setNoOfRows(1); break;
      default:                       setNoOfRows(4); break;
    }
  };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", background: "#080b14", minHeight: "100vh", color: "#e2e8f0" }}>

      {/* ── Header ── */}
      <header style={{ background: "#0e1221", borderBottom: "1px solid #1e2540", padding: "1rem 2rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "#00c2ff", letterSpacing: "-0.02em", margin: 0 }}>
          NETMON
        </h1>
        <span style={{ fontSize: "11px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Network Usage Dashboard
        </span>

        {/* Live badge */}
        <span style={{
          fontSize: "11px", padding: "4px 12px", borderRadius: "20px", fontWeight: 700, letterSpacing: "0.1em",
          background: isLive ? "#00ffb222" : "#ffaa0022",
          color:      isLive ? "#00ffb2"   : "#ffaa00",
          border:     `1px solid ${isLive ? "#00ffb255" : "#ffaa0055"}`,
        }}>
          {isLive ? "LIVE" : "WAITING"}
        </span>

        {/* Agent count */}
        <span style={{ fontSize: "11px", color: "#00ffb2" }}>
          {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </span>

        {/* Pulse dot */}
        {isLive && collecting && (
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#00ffb2", boxShadow: "0 0 8px #00ffb2",
            animation: "pulse 2s infinite",
          }} />
        )}

        {/* Timer */}
        {isLive && collecting && (
          <span style={{ fontSize: "13px", color: "#ff4f6a", fontWeight: 700 }}>
            {formatTime(timer)}
          </span>
        )}

        {/* Start / Stop button */}
        <button
          onClick={handleToggle}
          style={{
            padding: "6px 18px", borderRadius: "6px", border: "none",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em",
            background: collecting ? "#ff4f6a" : "#00ffb2",
            color: "#080b14", transition: "opacity 0.15s",
          }}
        >
          {collecting ? "STOP" : "START"}
        </button>

        {/* Lab selector */}
        <select
          value={selectedLab}
          onChange={(e) => handleLabChange(e.target.value)}
          style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: "6px",
            background: "#141828", border: "1px solid #1e2540",
            color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px", cursor: "pointer",
          }}
        >
          {labOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ background: "#0e1221", borderBottom: "1px solid #1e2540", padding: "0 2rem" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px", fontSize: "12px", fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em", textTransform: "uppercase",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #00c2ff" : "2px solid transparent",
                background: "transparent",
                color: activeTab === tab.id ? "#00c2ff" : "#4a5580",
                cursor: "pointer", transition: "color 0.15s",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {tab.label}
              {tab.id === "alerts" && alertCount > 0 && (
                <span style={{
                  background: "#ff4f6a", color: "#080b14", fontSize: "10px",
                  fontWeight: 700, borderRadius: "20px", padding: "1px 7px",
                  minWidth: "18px", textAlign: "center",
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: "2rem" }}>
        {activeTab === "monitor" && (
          <PCMonitorTab
            mockPCs={mockPCs}
            selectedLab={selectedLab}
            filteredPCs={filteredPCs}
            noOfRows={noOfRows}
          />
        )}
        {activeTab === "alerts" && (
          <AlertsTab onAlertCount={setAlertCount} selectedLab={selectedLab} />
        )}
        {activeTab === "analysis" && (
          <AnalysisTab selectedLab={selectedLab} filteredPCs={filteredPCs} />
        )}
        {activeTab === "config" && (
          <ConfigTab mockPCs={mockPCs} selectedLab={selectedLab} filteredPCs={filteredPCs} noOfRows={noOfRows} />
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
        option { background: #141828; }
      `}</style>
    </div>
  );
};

export default NetworkDashboard;