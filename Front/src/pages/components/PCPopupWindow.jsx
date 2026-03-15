import React, { useEffect, useState } from "react";
import pcImage from "./assets/pciamge.png";
import { useSelector } from "react-redux";
import axios from "axios";

const FETCH_INTERVAL = 3000;

function fmtBytes(b) {
  try { b = parseFloat(b); } catch { return "0 B"; }
  if (!b || b === 0) return "0 B";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MB`;
  if (b >= 1024)      return `${(b / 1024).toFixed(2)} KB`;
  return `${b.toFixed(0)} B`;
}

function fmtSpeed(bps) { return fmtBytes(bps) + "/s"; }

const PCPopupWindow = ({ selectedId }) => {
  const allPCs     = useSelector((state) => state.pcs.pcs);
  const selectedPC = allPCs.find((pc) => pc.id === selectedId);

  const [pcData,   setPcData]   = useState(null);
  const [pcAlerts, setPcAlerts] = useState([]);
  const [error,    setError]    = useState(null);

  // ── Reset on every PC change ──────────────────────────────────────────────
  useEffect(() => {
    setPcData(null);
    setError(null);
    setPcAlerts([]);
  }, [selectedId]);   // ← clears stale data before new fetch fires

  // ── Fetch agent data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPC?.mac || selectedPC.mac === "00:00:00:00:00:00") return;
    const fetch_ = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/data/${selectedPC.mac}`);
        setPcData(res.data);
        setError(null);
      } catch { setError("Agent offline"); }
    };
    fetch_();
    const id = setInterval(fetch_, FETCH_INTERVAL);
    return () => clearInterval(id);
  }, [selectedPC?.mac]);

  // ── Fetch alerts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPC?.mac || selectedPC.mac === "00:00:00:00:00:00") return;
    const fetch_ = async () => {
      try {
        const res  = await axios.get("http://127.0.0.1:5000/alerts");
        const RANK = { high: 0, medium: 1, low: 2 };
        setPcAlerts(
          (res.data.alerts || [])
            .filter((a) => a.mac === selectedPC.mac)
            .sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3))
        );
      } catch (_) {}
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [selectedPC?.mac]);

  useEffect(() => {
    if (!selectedPC?.mac || selectedPC.mac === "00:00:00:00:00:00") return;
    const fetch_ = async () => {
      try {
        const res  = await axios.get("http://127.0.0.1:5000/alerts");
        const RANK = { high: 0, medium: 1, low: 2 };
        setPcAlerts(
          (res.data.alerts || [])
            .filter((a) => a.mac === selectedPC.mac)
            .sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3))
        );
      } catch (_) {}
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [selectedPC?.mac]);

  const unassigned = selectedPC?.mac === "00:00:00:00:00:00";
  const isOnline   = pcData && (Date.now() / 1000 - pcData.timestamp) <= 10;
  const state      = pcData?.state ?? "sending";

  const processes  = pcData?.process ?? [];
  const dnsList    = pcData?.dns     ?? [];

  const maxSpeed = Math.max(
    ...processes.map((p) => (p.speed?.upload ?? 0) + (p.speed?.download ?? 0)),
    1
  );

  const SEVERITY = {
    high:   { bg: "#ff4f6a22", border: "#ff4f6a55", badge: "#ff4f6a", text: "#ff4f6a" },
    medium: { bg: "#ffaa0022", border: "#ffaa0055", badge: "#ffaa00", text: "#ffaa00" },
    low:    { bg: "#4a558022", border: "#4a558055", badge: "#4a5580", text: "#4a5580" },
  };

  const TYPE_LABEL = { inactive: "Inactive", high_usage: "High Usage", blacklist: "Blacklist" };

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#e2e8f0", height: "100%", overflowY: "auto", background: "#080b14" }}>

      {/* ── Agent header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", background: "#0e1221", border: "1px solid #1e2540", borderBottom: "none", borderRadius: "10px 10px 0 0", padding: "14px 20px" }}>
        <img src={pcImage} alt="PC" style={{ width: "36px", opacity: isOnline ? 1 : 0.4, filter: isOnline ? "none" : "grayscale(80%)" }} />

        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0" }}>
          {pcData?.hostname || selectedId}
        </span>

        {pcData?.os && (
          <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", background: "#0e2a3a", color: "#00c2ff", border: "1px solid #1a4a60" }}>
            {pcData.os}
          </span>
        )}

        <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", ...(isOnline ? { background: "#0e2a1a", color: "#00ffb2", border: "1px solid #1a4a2a" } : { background: "#2a1e0e", color: "#ffaa00", border: "1px solid #4a3a1a" }) }}>
          {isOnline ? "live" : "offline"}
        </span>

        <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", fontWeight: 600, letterSpacing: "0.08em", marginLeft: "auto", background: "#141828", color: "#4a5580", border: "1px solid #1e2540" }}>
          {selectedId}
        </span>
      </div>

      {/* ── Identity row ── */}
      <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #1e2540", borderTop: "1px solid #1a2040", borderBottom: "none", background: "#141828" }}>
        {[
          { label: "Username", value: pcData?.username ?? "—" },
          { label: "IP Address", value: pcData?.ip ?? "—" },
          { label: "MAC Address", value: selectedPC?.mac ?? "—" },
          { label: "Hostname", value: pcData?.hostname ?? "—" },
          { label: "Processes", value: processes.length },
        ].map(({ label, value }, i, arr) => (
          <div key={label} style={{ padding: "10px 20px", flex: 1, minWidth: "120px", borderRight: i < arr.length - 1 ? "1px solid #1e2540" : "none" }}>
            <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "13px", color: "#00c2ff", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Speed row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid #1e2540", borderBottom: "none" }}>
        {[
          { label: "Upload Speed",      value: fmtSpeed(pcData?.usage?.upload   ?? 0), color: "#00ffb2" },
          { label: "Download Speed",    value: fmtSpeed(pcData?.usage?.download ?? 0), color: "#00c2ff" },
          { label: "Total Uploaded",    value: fmtBytes(pcData?.total_usage?.upload   ?? 0), color: "#5de8b8" },
          { label: "Total Downloaded",  value: fmtBytes(pcData?.total_usage?.download ?? 0), color: "#5bb8e8" },
        ].map(({ label, value, color }, i) => (
          <div key={label} style={{ padding: "18px 20px", borderRight: i < 3 ? "1px solid #1e2540" : "none", background: "#0e1221" }}>
            <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 600, color }}>{value}</div>
          </div>
        ))}
      </div>

      {unassigned ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#4a5580", fontSize: "13px", border: "1px solid #1e2540", borderRadius: "0 0 10px 10px" }}>
          Assign a MAC address to view network data.
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#ff4f6a", fontSize: "13px", border: "1px solid #1e2540", borderRadius: "0 0 10px 10px" }}>
          {error}
        </div>
      ) : (
        <>
          {/* ── Process + DNS panels ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #1e2540", borderRadius: "0 0 10px 10px", overflow: "hidden", marginBottom: "16px" }}>

            {/* Process panel */}
            <div style={{ background: "#0e1221", borderRight: "1px solid #1e2540" }}>
              <div style={{ padding: "10px 16px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580", borderBottom: "1px solid #1e2540", background: "#141828", display: "flex", justifyContent: "space-between" }}>
                <span>Top Processes</span>
                <span style={{ color: "#00c2ff" }}>{processes.length}</span>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "300px" }}>
                {processes.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1e2540" }}>
                        {["#", "Name", "", "Live ↑", "Live ↓", "Total"].map((h, i) => (
                          <td key={i} style={{ padding: "6px 12px", fontSize: "10px", color: "#4a5580" }}>{h}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map((proc, i) => {
                        const spdUp = proc.speed?.upload   ?? 0;
                        const spdDn = proc.speed?.download ?? 0;
                        const totUp = proc.total?.upload   ?? 0;
                        const totDn = proc.total?.download ?? 0;
                        const barW  = Math.round(((spdUp + spdDn) / maxSpeed) * 100);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #1e2540" }}>
                            <td style={{ padding: "8px 12px", fontSize: "11px", color: "#4a5580", width: "18px" }}>{i + 1}</td>
                            <td style={{ padding: "8px 12px", fontSize: "11px", color: "#e2e8f0", fontWeight: 600, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={proc.name}>{proc.name}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <div style={{ width: "60px", height: "3px", background: "#1e2540", borderRadius: "2px" }}>
                                <div style={{ width: `${barW}%`, height: "100%", background: "#00c2ff", borderRadius: "2px" }} />
                              </div>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: "11px", color: "#00ffb2" }}>{fmtSpeed(spdUp)}</td>
                            <td style={{ padding: "8px 12px", fontSize: "11px", color: "#00c2ff" }}>{fmtSpeed(spdDn)}</td>
                            <td style={{ padding: "8px 12px", fontSize: "10px", color: "#4a5580" }}>{fmtBytes(totUp + totDn)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: "20px 16px", color: "#4a5580", fontSize: "12px" }}>
                    {state === "ready" ? "Agent paused — no data this interval" : "No process data yet"}
                  </div>
                )}
              </div>
            </div>

            {/* DNS panel */}
            <div style={{ background: "#0e1221" }}>
              <div style={{ padding: "10px 16px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580", borderBottom: "1px solid #1e2540", background: "#141828", display: "flex", justifyContent: "space-between" }}>
                <span>Sites Accessed</span>
                <span style={{ color: "#00c2ff" }}>{dnsList.length}</span>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "300px" }}>
                {dnsList.length > 0 ? (
                  dnsList.map((domain, i) => (
                    <div key={i} style={{ padding: "7px 16px", fontSize: "12px", color: "#e2e8f0", borderBottom: "1px solid #1e2540", display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ffb2", flexShrink: 0 }} />
                      {domain}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "20px 16px", color: "#4a5580", fontSize: "12px" }}>
                    {state === "ready" ? "Agent paused" : "No DNS queries recorded"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Alerts ── */}
          <div style={{ background: "#0e1221", border: "1px solid #1e2540", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580", borderBottom: "1px solid #1e2540", background: "#141828", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Alerts</span>
              {pcAlerts.length > 0 && (
                <span style={{ background: "#ff4f6a", color: "#080b14", fontSize: "10px", fontWeight: 700, borderRadius: "20px", padding: "1px 8px" }}>
                  {pcAlerts.length}
                </span>
              )}
            </div>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {pcAlerts.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "#00ffb2", fontSize: "12px", textAlign: "center" }}>
                  No alerts for this PC
                </div>
              ) : (
                pcAlerts.map((alert, i) => {
                  const s = SEVERITY[alert.severity] ?? SEVERITY.low;
                  return (
                    <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid #1e2540", background: s.bg, display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: s.badge, color: "#080b14", flexShrink: 0, textTransform: "uppercase" }}>
                        {alert.severity}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>{alert.message}</div>
                        {alert.type === "high_usage" && (
                          <div style={{ fontSize: "10px", color: "#4a5580", marginTop: "2px" }}>
                            {alert.total_usage_MB} MB / {alert.limit_MB} MB limit
                          </div>
                        )}
                        {alert.type === "blacklist" && (
                          <div style={{ fontSize: "10px", color: "#4a5580", marginTop: "2px" }}>
                            Site: {alert.site}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: "10px", color: "#4a5580", flexShrink: 0 }}>
                        {TYPE_LABEL[alert.type] || alert.type}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PCPopupWindow;