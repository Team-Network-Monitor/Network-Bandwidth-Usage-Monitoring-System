import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const BASE = "http://127.0.0.1:5000";
const POLL_INTERVAL = 3000;
const MAX_POINTS = 20;

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
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#e11d48",
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-mono font-bold">{formatBytes(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Lab-wide Top Sites ────────────────────────────────────────────────────────
const LabTopSites = ({ assignedPCs }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignedPCs?.length) return;

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          assignedPCs.map((pc) =>
            axios.get(`${BASE}/data/${pc.mac}`)
              .then((r) => r.data)
              .catch(() => null)
          )
        );

        // Merge all PCs download + upload by domain
        const merged = {};
        results.forEach((data) => {
          if (!data) return;
          for (const [domain, info] of Object.entries(data.download || {})) {
            merged[domain] = (merged[domain] || 0) + (info.total_bytes || 0);
          }
          for (const [domain, info] of Object.entries(data.upload || {})) {
            merged[domain] = (merged[domain] || 0) + (info.total_bytes || 0);
          }
        });

        const sorted = Object.entries(merged)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([domain, bytes]) => ({ domain, bytes }));

        setSites(sorted);
      } catch (err) {
        console.error("Failed to fetch lab top sites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [assignedPCs]);

  const maxBytes = sites[0]?.bytes || 1;
  const totalBytes = sites.reduce((s, d) => s + d.bytes, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-4 animate-pulse">Loading...</p>
      ) : sites.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-4">No traffic data yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Table header */}
          <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase font-bold pb-1 border-b border-gray-100">
            <span className="w-4">#</span>
            <span className="w-44">Domain</span>
            <span className="flex-1">Traffic Share</span>
            <span className="w-20 text-right">Total</span>
            <span className="w-12 text-right">%</span>
          </div>
          {sites.map(({ domain, bytes }, i) => {
            const pct = (bytes / maxBytes) * 100;
            const sharePct = ((bytes / totalBytes) * 100).toFixed(1);
            return (
              <div key={domain} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}</span>
                <span className="text-sm text-gray-700 font-mono w-44 truncate shrink-0">{domain}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-600 w-20 text-right shrink-0">
                  {formatBytes(bytes).replace("/s", "")}
                </span>
                <span className="font-mono text-[10px] text-gray-400 w-12 text-right shrink-0">
                  {sharePct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── AnalysisTab ───────────────────────────────────────────────────────────────
const AnalysisTab = ({ selectedLab, filteredPCs }) => {
  const allPCs = useSelector((state) => state.pcs.pcs);
  const [chartMode, setChartMode] = useState("download");
  const [history, setHistory] = useState([]);
  const tickRef = useRef(0);

  const assignedPCs = useMemo(() => {
    const [start, end] = LAB_RANGES[selectedLab] ?? [0, 100];
    return allPCs
      .slice(start, end)
      .filter((pc) => pc.mac && pc.mac !== "00:00:00:00:00:00");
  }, [allPCs, selectedLab]);

  useEffect(() => {
    if (assignedPCs.length === 0) return;
    setHistory([]); // reset chart when lab changes

    const poll = async () => {
      try {
        const results = await Promise.all(
          assignedPCs.map((pc) =>
            axios.get(`${BASE}/data/${pc.mac}`)
              .then((r) => ({
                id: pc.id,
                download: r.data.download_speed ?? 0,
                upload: r.data.upload_speed ?? 0,
              }))
              .catch(() => ({ id: pc.id, download: 0, upload: 0 }))
          )
        );

        const now = new Date();
        const timeLabel = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
        const point = { time: timeLabel };
        results.forEach(({ id, download, upload }) => {
          point[`${id}_dl`] = download;
          point[`${id}_ul`] = upload;
        });

        setHistory((prev) => {
          const next = [...prev, point];
          return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
        });

        tickRef.current += 1;
      } catch (err) {
        console.error("Analysis poll error:", err);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [assignedPCs]);

  const latest = history[history.length - 1];
  const summaryStats = assignedPCs.map((pc, i) => ({
    id: pc.id,
    mac: pc.mac,
    color: COLORS[i % COLORS.length],
    download: latest?.[`${pc.id}_dl`] ?? 0,
    upload: latest?.[`${pc.id}_ul`] ?? 0,
  }));

  const sortedStats = [...summaryStats].sort(
    (a, b) => parseInt(a.id.replace("PC-", "")) - parseInt(b.id.replace("PC-", ""))
  );

  const totalDownload = summaryStats.reduce((s, p) => s + p.download, 0);
  const totalUpload = summaryStats.reduce((s, p) => s + p.upload, 0);
  const topPC = [...summaryStats].sort((a, b) => b.download - a.download)[0];

  if (assignedPCs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="text-5xl mb-4">📡</div>
        <p className="font-semibold text-lg">No MACs assigned in this lab section</p>
        <p className="text-sm mt-1">Go to Config tab to assign MAC addresses</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-8">

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <p className="text-blue-200 text-[10px] uppercase font-bold tracking-wider">Active MACs</p>
          <p className="text-3xl font-black mt-1">{assignedPCs.length}</p>
        </div>
        <div className="bg-emerald-500 rounded-xl p-4 text-white">
          <p className="text-emerald-100 text-[10px] uppercase font-bold tracking-wider">Total ↓ Download</p>
          <p className="text-2xl font-black mt-1">{formatBytes(totalDownload)}</p>
        </div>
        <div className="bg-violet-500 rounded-xl p-4 text-white">
          <p className="text-violet-100 text-[10px] uppercase font-bold tracking-wider">Total ↑ Upload</p>
          <p className="text-2xl font-black mt-1">{formatBytes(totalUpload)}</p>
        </div>
        <div className="bg-amber-500 rounded-xl p-4 text-white">
          <p className="text-amber-100 text-[10px] uppercase font-bold tracking-wider">Top PC</p>
          <p className="text-2xl font-black mt-1">{topPC?.id ?? "—"}</p>
          <p className="text-amber-100 text-[10px] mt-0.5">{formatBytes(topPC?.download ?? 0)}</p>
        </div>
      </div>

      {/* Chart mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black text-gray-700 uppercase tracking-wider">Speed Over Time</h2>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { id: "download", label: "↓ Download" },
            { id: "upload",   label: "↑ Upload" },
            { id: "both",     label: "Both" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setChartMode(m.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                chartMode === m.id ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:text-blue-600"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Chart */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-5">
        {history.length < 2 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            <span className="animate-pulse">Collecting data...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={history} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#374151" }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatBytes} tick={{ fill: "#9ca3af", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#374151" }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px" }} formatter={(v) => <span style={{ color: "#d1d5db" }}>{v}</span>} />
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

      {/* Per-PC Breakdown */}
      <h2 className="text-base font-black text-gray-700 uppercase tracking-wider mb-3">Live Per-PC Breakdown</h2>
      <div className="grid grid-cols-1 gap-2 mb-6">
        {sortedStats.map((pc) => {
          const dlPct = totalDownload > 0 ? (pc.download / totalDownload) * 100 : 0;
          return (
            <div key={pc.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2 w-20 shrink-0">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ background: pc.color }} />
                <span className="text-sm font-bold text-gray-700">{pc.id}</span>
              </div>
              <span className="font-mono text-xs text-gray-400 w-36 shrink-0 truncate">{pc.mac}</span>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>↓ {formatBytes(pc.download)}</span>
                  <span>↑ {formatBytes(pc.upload)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dlPct}%`, background: pc.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Visited Sites - combined across all PCs */}
      <h2 className="text-base font-black text-gray-700 uppercase tracking-wider mb-3">Top Visited Sites</h2>
      <LabTopSites assignedPCs={sortedStats} />

    </div>
  );
};

export default AnalysisTab;