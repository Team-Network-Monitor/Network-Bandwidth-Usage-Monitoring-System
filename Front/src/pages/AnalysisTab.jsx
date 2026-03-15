import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const BASE          = "http://127.0.0.1:5000";
const POLL_INTERVAL = 3000;
const MAX_POINTS    = 20;
const mono          = "'JetBrains Mono', monospace";

const LAB_RANGES = {
  All:      [0, 100],
  CSL3:     [0, 50],
  CSL4:     [50, 100],
  "CSL3.1": [0, 25],
  "CSL3.2": [25, 50],
  "CSL4.1": [50, 75],
  "CSL4.2": [75, 100],
};

const COLORS = [
  "#00c2ff", "#00ffb2", "#ff4f6a", "#ffaa00",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#e11d48",
];

const IGNORE_SUFFIXES = [".local", ".arpa", ".internal"];
const IGNORE_EXACT    = new Set(["macvendors.com", "macvendors.net"]);

function filterDomain(domain) {
  if (!domain) return false;
  if (IGNORE_EXACT.has(domain)) return false;
  if (IGNORE_SUFFIXES.some((s) => domain.endsWith(s))) return false;
  return true;
}

function fmtBytes(b, speed = false) {
  try { b = parseFloat(b); } catch { return speed ? "0 B/s" : "0 B"; }
  if (!b || b <= 0) return speed ? "0 B/s" : "0 B";
  const suffix = speed ? "/s" : "";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB${suffix}`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB${suffix}`;
  if (b >= 1024)      return `${(b / 1024).toFixed(1)} KB${suffix}`;
  return `${b.toFixed(0)} B${suffix}`;
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
const DetailModal = ({ item, type, onClose }) => {
  if (!item) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, fontFamily: mono,
    }} onClick={onClose}>
      <div style={{
        background: "#0e1221", border: "1px solid #1e2540",
        borderRadius: "10px", padding: "24px", minWidth: "360px",
        maxWidth: "480px", width: "90%",
      }} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
              {type === "site" ? "Site Accessed By" : "Process Running On"}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: type === "site" ? "#00c2ff" : "#00ffb2" }}>
              {item.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#ff4f6a", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {item.pcs.map((pc, i) => (
            <div key={i} style={{
              background: "#141828", border: "1px solid #1e2540",
              borderRadius: "8px", padding: "10px 14px",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0" }}>{pc.id}</div>
                <div style={{ fontSize: "10px", color: "#4a5580", marginTop: "2px" }}>{pc.mac}</div>
                {pc.hostname && pc.hostname !== "Unknown" && (
                  <div style={{ fontSize: "10px", color: "#00c2ff", marginTop: "1px" }}>{pc.hostname}</div>
                )}
              </div>
              {type === "process" && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "11px", color: "#00ffb2" }}>↑ {fmtBytes(pc.upload, true)}</div>
                  <div style={{ fontSize: "11px", color: "#00c2ff" }}>↓ {fmtBytes(pc.download, true)}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "14px", fontSize: "10px", color: "#4a5580", textAlign: "center" }}>
          Click outside to close
        </div>
      </div>
    </div>
  );
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0e1221", border: "1px solid #1e2540",
      borderRadius: "8px", padding: "10px 14px",
      fontFamily: mono, fontSize: "11px",
    }}>
      <div style={{ color: "#4a5580", marginBottom: "6px" }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: entry.color }} />
          <span style={{ color: "#4a5580" }}>{entry.name}:</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{fmtBytes(entry.value, true)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Top Sites ─────────────────────────────────────────────────────────────────
const LabTopSites = ({ assignedPCs, colorMap, onSelect }) => {
  const [sites,   setSites]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({});

  useEffect(() => {
    if (!assignedPCs?.length) return;

    const fetch_ = async () => {
      try {
        const results = await Promise.all(
          assignedPCs.map((pc) =>
            axios.get(`${BASE}/data/${pc.mac}`)
              .then((r) => ({ pc, dns: r.data?.dns ?? [], hostname: r.data?.hostname }))
              .catch(() => ({ pc, dns: [], hostname: null }))
          )
        );

        const domainMap = {};
        results.forEach(({ pc, dns, hostname }) => {
          dns.filter(filterDomain).forEach((domain) => {
            if (!domainMap[domain]) domainMap[domain] = [];
            if (!domainMap[domain].find((p) => p.id === pc.id)) {
              domainMap[domain].push({ ...pc, hostname, color: colorMap[pc.id] });
            }
          });
        });

        setRawData(domainMap);

        const sorted = Object.entries(domainMap)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 15)
          .map(([domain, pcs]) => ({ domain, count: pcs.length }));

        setSites(sorted);
      } catch (err) {
        console.error("Failed to fetch top sites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch_();
    const id = setInterval(fetch_, 10000);
    return () => clearInterval(id);
  }, [assignedPCs]);

  const maxCount = sites[0]?.count || 1;

  return (
    <div style={{ background: "#0e1221", border: "1px solid #1e2540", borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "#141828", borderBottom: "1px solid #1e2540", display: "flex", justifyContent: "space-between", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580" }}>
        <span>Domain</span>
        <span style={{ color: "#00c2ff" }}>{sites.length} sites</span>
      </div>

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#4a5580", fontSize: "12px" }}>Loading...</div>
      ) : sites.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#4a5580", fontSize: "12px" }}>No DNS data yet</div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "12px", padding: "8px 16px", fontSize: "10px", color: "#4a5580", borderBottom: "1px solid #1e2540" }}>
            <span style={{ width: "20px" }}>#</span>
            <span style={{ flex: 1 }}>Domain</span>
            <span style={{ width: "120px" }}>Accessed by</span>
            <span style={{ width: "40px", textAlign: "right" }}>PCs</span>
          </div>
          {sites.map(({ domain, count }, i) => {
            const pcs = rawData[domain] || [];
            return (
              <div
                key={domain}
                onClick={() => onSelect({ name: domain, pcs })}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 16px", borderBottom: "1px solid #1e2540", cursor: "pointer" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#141828"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ width: "20px", fontSize: "11px", color: "#4a5580" }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: "12px", color: "#00c2ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain}</span>
                <div style={{ width: "120px", display: "flex", gap: "3px", alignItems: "center" }}>
                  {pcs.slice(0, 6).map((pc) => (
                    <div key={pc.id} title={pc.id} style={{ width: "8px", height: "8px", borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
                  ))}
                  {pcs.length > 6 && <span style={{ fontSize: "9px", color: "#4a5580" }}>+{pcs.length - 6}</span>}
                </div>
                <span style={{ width: "40px", textAlign: "right", fontSize: "11px", color: "#00ffb2", fontWeight: 600 }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Top Processes ─────────────────────────────────────────────────────────────
const LabTopProcesses = ({ assignedPCs, colorMap, onSelect }) => {
  const [procs,   setProcs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({});

  useEffect(() => {
    if (!assignedPCs?.length) return;

    const fetch_ = async () => {
      try {
        const results = await Promise.all(
          assignedPCs.map((pc) =>
            axios.get(`${BASE}/data/${pc.mac}`)
              .then((r) => ({ pc, process: r.data?.process ?? [], hostname: r.data?.hostname }))
              .catch(() => ({ pc, process: [], hostname: null }))
          )
        );

        const procMap = {};
        results.forEach(({ pc, process, hostname }) => {
          process.forEach((p) => {
            if (!procMap[p.name]) procMap[p.name] = { upload: 0, download: 0, pcs: [] };
            procMap[p.name].upload   += p.speed?.upload   ?? 0;
            procMap[p.name].download += p.speed?.download ?? 0;
            if (!procMap[p.name].pcs.find((x) => x.id === pc.id)) {
              procMap[p.name].pcs.push({
                ...pc, hostname, color: colorMap[pc.id],
                upload:   p.speed?.upload   ?? 0,
                download: p.speed?.download ?? 0,
              });
            }
          });
        });

        setRawData(procMap);

        const sorted = Object.entries(procMap)
          .sort((a, b) => (b[1].upload + b[1].download) - (a[1].upload + a[1].download))
          .slice(0, 10)
          .map(([name, stats]) => ({ name, upload: stats.upload, download: stats.download, count: stats.pcs.length }));

        setProcs(sorted);
      } catch (err) {
        console.error("Failed to fetch top processes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch_();
    const id = setInterval(fetch_, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [assignedPCs]);

  const maxSpeed = Math.max(...procs.map((p) => p.upload + p.download), 1);

  return (
    <div style={{ background: "#0e1221", border: "1px solid #1e2540", borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "#141828", borderBottom: "1px solid #1e2540", display: "flex", justifyContent: "space-between", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580" }}>
        <span>Process</span>
        <span style={{ color: "#00c2ff" }}>Click to see which PCs</span>
      </div>

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#4a5580", fontSize: "12px" }}>Loading...</div>
      ) : procs.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#4a5580", fontSize: "12px" }}>No process data yet</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e2540" }}>
              {["#", "Name", "", "Live ↑", "Live ↓", "PCs"].map((h, i) => (
                <td key={i} style={{ padding: "6px 12px", fontSize: "10px", color: "#4a5580" }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {procs.map((p, i) => {
              const barW = Math.round(((p.upload + p.download) / maxSpeed) * 100);
              const pcs  = rawData[p.name]?.pcs || [];
              return (
                <tr
                  key={p.name}
                  onClick={() => onSelect({ name: p.name, pcs })}
                  style={{ borderBottom: "1px solid #1e2540", cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#141828"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "8px 12px", fontSize: "11px", color: "#4a5580", width: "20px" }}>{i + 1}</td>
                  <td style={{ padding: "8px 12px", fontSize: "12px", color: "#e2e8f0", fontWeight: 600, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</td>
                  <td style={{ padding: "8px 12px", width: "80px" }}>
                    <div style={{ height: "3px", background: "#1e2540", borderRadius: "2px" }}>
                      <div style={{ width: `${barW}%`, height: "100%", background: "#00c2ff", borderRadius: "2px" }} />
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: "11px", color: "#00ffb2" }}>{fmtBytes(p.upload, true)}</td>
                  <td style={{ padding: "8px 12px", fontSize: "11px", color: "#00c2ff" }}>{fmtBytes(p.download, true)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                      {pcs.slice(0, 4).map((pc) => (
                        <div key={pc.id} title={pc.id} style={{ width: "8px", height: "8px", borderRadius: "50%", background: pc.color }} />
                      ))}
                      {pcs.length > 4 && <span style={{ fontSize: "9px", color: "#4a5580" }}>+{pcs.length - 4}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

// ── AnalysisTab ───────────────────────────────────────────────────────────────
const AnalysisTab = ({ selectedLab, filteredPCs }) => {
  const allPCs      = useSelector((state) => state.pcs.pcs);
  const [chartMode, setChartMode] = useState("download");
  const [history,   setHistory]   = useState([]);
  const [modal,     setModal]     = useState(null);
  const [modalType, setModalType] = useState(null);
  const [totals,    setTotals]    = useState({ upload: 0, download: 0 });

  const assignedPCs = useMemo(() => {
    const [start, end] = LAB_RANGES[selectedLab] ?? [0, 100];
    return allPCs
      .slice(start, end)
      .filter((pc) => pc.mac && pc.mac !== "00:00:00:00:00:00");
  }, [allPCs, selectedLab]);

  const colorMap = useMemo(() => {
    const map = {};
    assignedPCs.forEach((pc, i) => { map[pc.id] = COLORS[i % COLORS.length]; });
    return map;
  }, [assignedPCs]);

  useEffect(() => {
    if (!assignedPCs.length) return;
    setHistory([]);

    const poll = async () => {
      try {
        const results = await Promise.all(
          assignedPCs.map((pc) =>
            axios.get(`${BASE}/data/${pc.mac}`)
              .then((r) => ({
                id:        pc.id,
                download:  r.data?.usage?.download       ?? 0,
                upload:    r.data?.usage?.upload         ?? 0,
                totalUp:   r.data?.total_usage?.upload   ?? 0,
                totalDown: r.data?.total_usage?.download ?? 0,
              }))
              .catch(() => ({ id: pc.id, download: 0, upload: 0, totalUp: 0, totalDown: 0 }))
          )
        );

        setTotals({
          upload:   results.reduce((s, r) => s + r.totalUp,   0),
          download: results.reduce((s, r) => s + r.totalDown, 0),
        });

        const now   = new Date();
        const label = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
        const point = { time: label };
        results.forEach(({ id, download, upload, totalUp, totalDown }) => {
          point[`${id}_dl`]   = download;
          point[`${id}_ul`]   = upload;
          point[`${id}_tup`]  = totalUp;
          point[`${id}_tdwn`] = totalDown;
        });

        setHistory((prev) => {
          const next = [...prev, point];
          return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
        });
      } catch (err) {
        console.error("Analysis poll error:", err);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [assignedPCs]);

  const latest = history[history.length - 1];

  const statsRows = assignedPCs.map((pc, i) => ({
    id:        pc.id,
    mac:       pc.mac,
    color:     COLORS[i % COLORS.length],
    download:  latest?.[`${pc.id}_dl`]   ?? 0,
    upload:    latest?.[`${pc.id}_ul`]   ?? 0,
    totalUp:   latest?.[`${pc.id}_tup`]  ?? 0,
    totalDown: latest?.[`${pc.id}_tdwn`] ?? 0,
  })).sort((a, b) => b.download - a.download); // live sorted

  const totalDownload = statsRows.reduce((s, p) => s + p.download, 0);
  const totalUpload   = statsRows.reduce((s, p) => s + p.upload,   0);
  const topPC         = statsRows[0]; // already sorted by download

  if (assignedPCs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "6rem", color: "#4a5580", fontFamily: mono }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📡</div>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>No MACs assigned in this lab section</div>
        <div style={{ fontSize: "12px", marginTop: "6px" }}>Go to Config tab to assign MAC addresses</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: mono, color: "#e2e8f0", paddingBottom: "2rem" }}>

      <DetailModal
        item={modal}
        type={modalType}
        onClose={() => { setModal(null); setModalType(null); }}
      />

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Active MACs",      value: assignedPCs.length,           color: "#00c2ff" },
          { label: "Live ↓",           value: fmtBytes(totalDownload, true), color: "#00ffb2" },
          { label: "Live ↑",           value: fmtBytes(totalUpload,   true), color: "#ffaa00" },
          { label: "Session Total ↓",  value: fmtBytes(totals.download),     color: "#5bb8e8" },
          { label: "Session Total ↑",  value: fmtBytes(totals.upload),       color: "#5de8b8" },
          { label: "Top PC",           value: topPC?.id ?? "—",              color: "#ff4f6a", sub: topPC ? fmtBytes(topPC.download, true) : "" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: "#0e1221", border: `1px solid ${color}44`, borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "9px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>{label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color }}>{value}</div>
            {sub && <div style={{ fontSize: "11px", color: "#4a5580", marginTop: "4px" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Chart mode toggle ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580" }}>Speed Over Time</span>
        <div style={{ display: "flex", gap: "4px", background: "#141828", padding: "4px", borderRadius: "8px", border: "1px solid #1e2540" }}>
          {[
            { id: "download", label: "↓ Download" },
            { id: "upload",   label: "↑ Upload" },
            { id: "both",     label: "Both" },
          ].map((m) => (
            <button key={m.id} onClick={() => setChartMode(m.id)} style={{
              padding: "5px 12px", borderRadius: "6px", border: "none",
              background: chartMode === m.id ? "#00c2ff" : "transparent",
              color:      chartMode === m.id ? "#080b14" : "#4a5580",
              fontFamily: mono, fontSize: "11px", fontWeight: 700, cursor: "pointer",
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Line chart ── */}
      <div style={{ background: "#0e1221", border: "1px solid #1e2540", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
        {history.length < 2 ? (
          <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5580", fontSize: "12px" }}>
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart key={chartMode} data={history} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2540" />
              <XAxis dataKey="time" tick={{ fill: "#4a5580", fontSize: 10, fontFamily: mono }} tickLine={false} axisLine={{ stroke: "#1e2540" }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => fmtBytes(v, true)} tick={{ fill: "#4a5580", fontSize: 10, fontFamily: mono }} tickLine={false} axisLine={{ stroke: "#1e2540" }} width={75} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", fontFamily: mono }} formatter={(v) => <span style={{ color: "#4a5580" }}>{v}</span>} />
              {assignedPCs.map((pc, i) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <React.Fragment key={pc.id}>
                    {(chartMode === "download" || chartMode === "both") && (
                      <Line type="monotone" dataKey={`${pc.id}_dl`} name={`${pc.id} ↓`} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    )}
                    {(chartMode === "upload" || chartMode === "both") && (
                      <Line type="monotone" dataKey={`${pc.id}_ul`} name={`${pc.id} ↑`} stroke={color} strokeWidth={2} strokeDasharray="4 2" dot={false} activeDot={{ r: 4 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Per-PC breakdown ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580" }}>
          Live Per-PC Breakdown
        </span>
        <span style={{ fontSize: "10px", color: "#4a5580" }}>sorted by live download</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
        {statsRows.map((pc, rank) => {
          const dlPct = totalDownload > 0 ? (pc.download / totalDownload) * 100 : 0;
          return (
            <div key={pc.id} style={{
              background: "#0e1221", border: "1px solid #1e2540",
              borderRadius: "8px", padding: "10px 16px",
              display: "flex", alignItems: "center", gap: "16px",
            }}>
              <span style={{ fontSize: "11px", color: "#4a5580", width: "16px", flexShrink: 0, textAlign: "center" }}>
                {rank + 1}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "70px", flexShrink: 0 }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: pc.color, flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0" }}>{pc.id}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#4a5580", width: "140px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pc.mac}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "4px" }}>
                  <span style={{ color: "#00ffb2" }}>↑ {fmtBytes(pc.upload, true)}</span>
                  <span style={{ color: "#00c2ff" }}>↓ {fmtBytes(pc.download, true)}</span>
                </div>
                <div style={{ height: "3px", background: "#1e2540", borderRadius: "2px" }}>
                  <div style={{ width: `${dlPct}%`, height: "100%", background: pc.color, borderRadius: "2px", transition: "width 0.7s" }} />
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: "90px" }}>
                <div style={{ fontSize: "10px", color: "#5de8b8" }}>↑ {fmtBytes(pc.totalUp)}</div>
                <div style={{ fontSize: "10px", color: "#5bb8e8" }}>↓ {fmtBytes(pc.totalDown)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Top processes ── */}
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580", marginBottom: "12px" }}>
        Top Processes (Lab-wide)
      </div>
      <div style={{ marginBottom: "20px" }}>
        <LabTopProcesses
          assignedPCs={assignedPCs}
          colorMap={colorMap}
          onSelect={(item) => { setModal(item); setModalType("process"); }}
        />
      </div>

      {/* ── Top sites ── */}
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4a5580", marginBottom: "12px" }}>
        Top Visited Sites (Lab-wide)
      </div>
      <LabTopSites
        assignedPCs={assignedPCs}
        colorMap={colorMap}
        onSelect={(item) => { setModal(item); setModalType("site"); }}
      />

    </div>
  );
};

export default AnalysisTab;