import React, { useEffect, useState, useRef } from "react";
import pcImage from "./assets/pciamge.png";
import { useSelector } from "react-redux";
import axios from "axios";

const SEVERITY_BADGE = {
  high: "bg-red-500 text-white",
  medium: "bg-orange-400 text-white",
  low: "bg-gray-400 text-white",
};

const TYPE_LABEL = {
  inactive: "Inactive",
  high_usage: "High Usage",
  blacklist: "Blacklist",
};

const FETCH_INTERVAL = 3000;

function formatBytes(bytes, isSpeed = false) {
  if (!bytes || bytes === 0) return isSpeed ? "0 B/s" : "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024;
    index++;
  }
  return `${bytes.toFixed(2)} ${units[index]}${isSpeed ? "/s" : ""}`;
}

// Merge download + upload domains into a combined list sorted by total bytes
function mergeTraffic(download = {}, upload = {}) {
  const merged = {};
  for (const [domain, data] of Object.entries(download)) {
    merged[domain] = { domain, download: data.total_bytes, upload: 0, protocols: data.protocols };
  }
  for (const [domain, data] of Object.entries(upload)) {
    if (merged[domain]) {
      merged[domain].upload = data.total_bytes;
    } else {
      merged[domain] = { domain, download: 0, upload: data.total_bytes, protocols: data.protocols };
    }
  }
  return Object.values(merged).sort(
    (a, b) => (b.download + b.upload) - (a.download + a.upload)
  );
}

const PCPopupWindow = ({ selectedId }) => {
  const allPCs = useSelector((state) => state.pcs.pcs);
  const selectedPC = allPCs.find((pc) => pc.id === selectedId);

  const [pcData, setPcData] = useState(null);
  const [error, setError] = useState(null);
  const [pcAlerts, setPcAlerts] = useState([]);
  const [downloadSpeed, setDownloadSpeed] = useState("0 B/s");
  const [uploadSpeed, setUploadSpeed] = useState("0 B/s");
  const lastTotalRef = useRef(0);

  // Fetch network data for this PC
  useEffect(() => {
    if (!selectedPC?.mac || selectedPC.mac === "00:00:00:00:00:00") return;

    const fetchData = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:5000/data/${selectedPC.mac}`);
        const data = res.data;

        // Use live speed fields from API directly
        setDownloadSpeed(formatBytes(data.download_speed ?? 0, true));
        setUploadSpeed(formatBytes(data.upload_speed ?? 0, true));

        setPcData(data);
        lastTotalRef.current = data.total_usage ?? 0;
        setError(null);
      } catch (err) {
        setError("Error fetching data");
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, FETCH_INTERVAL);
    return () => {
      clearInterval(interval);
      lastTotalRef.current = 0;
    };
  }, [selectedPC?.mac]);

  // Fetch alerts filtered by this PC's MAC
  useEffect(() => {
    if (!selectedPC?.mac || selectedPC.mac === "00:00:00:00:00:00") return;

    const fetchAlerts = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:5000/alerts");
        const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
        const filtered = (res.data.alerts || [])
          .filter((a) => a.mac === selectedPC.mac)
          .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
        setPcAlerts(filtered);
      } catch (err) {
        console.error("Error fetching alerts:", err);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [selectedPC?.mac]);

  const trafficList = pcData ? mergeTraffic(pcData.download, pcData.upload) : [];
  const unassigned = selectedPC?.mac === "00:00:00:00:00:00";

  return (
    <div className="p-4">
      {/* Title */}
      <h1 className="text-center text-4xl font-black text-blue-500 mb-2">{selectedId}</h1>

      {/* PC Image */}
      <div className="relative group">
        <img src={pcImage} alt="PC" width="160px" className="m-auto opacity-90 group-hover:opacity-100 transition-opacity" />
        {pcData?.hostname && (
          <div className="absolute top-0 right-10 bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full border border-blue-300">
            {pcData.hostname}
          </div>
        )}
      </div>

      {/* MAC + IP */}
      <div className="flex flex-col items-center text-blue-500 -mt-2 mb-4">
        <h2 className="text-xl font-bold font-mono bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
          {selectedPC?.mac}
        </h2>
        <h3 className="font-mono text-sm text-blue-400 mt-1">
          IP: {pcData?.ip || "Detecting..."}
        </h3>
      </div>

      {unassigned ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Assign a MAC address to view network data.
        </div>
      ) : (
        <>
          {/* BANDWIDTH & USAGE */}
          <div className="grid grid-cols-3 gap-2 mx-4 mb-4">
            <div className="bg-blue-600 rounded-xl p-3 text-white shadow-lg">
              <p className="text-blue-100 text-[10px] uppercase font-bold tracking-tighter">↓ Download</p>
              <h3 className="text-lg font-black truncate">{downloadSpeed}</h3>
            </div>
            <div className="bg-blue-500 rounded-xl p-3 text-white shadow-lg">
              <p className="text-blue-100 text-[10px] uppercase font-bold tracking-tighter">↑ Upload</p>
              <h3 className="text-lg font-black truncate">{uploadSpeed}</h3>
            </div>
            <div className="bg-white border-2 border-blue-600 rounded-xl p-3 text-blue-600">
              <p className="text-blue-400 text-[10px] uppercase font-bold tracking-tighter">Total</p>
              <h3 className="text-lg font-black truncate">
                {formatBytes(pcData?.total_usage ?? 0)}
              </h3>
            </div>
          </div>

          {/* TOP DESTINATIONS */}
          <div className="mx-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-blue-500 font-black uppercase text-xs tracking-wider">Top Destinations</h3>
              <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> LIVE
              </span>
            </div>
            <div className="border-t-2 border-blue-100 pt-2">
              <div className="overflow-y-auto h-36 pr-1">
                {trafficList.length > 0 ? (
                  trafficList.map((item) => (
                    <div key={item.domain} className="flex justify-between items-center bg-blue-50 border border-transparent hover:border-blue-300 rounded-lg p-2 mb-1 transition-all">
                      <div className="truncate text-blue-700 font-medium text-xs max-w-[130px]">
                        {item.domain}
                        <span className="ml-1 text-[9px] text-blue-400">{item.protocols?.join(", ")}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-mono text-[10px] text-blue-500 bg-white px-1.5 py-0.5 rounded border">
                          ↓ {formatBytes(item.download)}
                        </span>
                        <span className="font-mono text-[10px] text-blue-500 bg-white px-1.5 py-0.5 rounded border">
                          ↑ {formatBytes(item.upload)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-blue-400 text-sm font-semibold">
                    {error ? "Failed to load data" : "Analyzing packets..."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ALERTS */}
          <div className="mx-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-blue-500 font-black uppercase text-xs tracking-wider">Alerts</h3>
              {pcAlerts.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {pcAlerts.length}
                </span>
              )}
            </div>
            <div className="border-t-2 border-blue-100 pt-2">
              {pcAlerts.length === 0 ? (
                <div className="text-center py-3 text-green-500 text-xs font-semibold">
                  No alerts for this PC
                </div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-32">
                  {pcAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${SEVERITY_BADGE[alert.severity] || SEVERITY_BADGE.low}`}>
                        {alert.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate">{alert.message}</div>
                        {alert.type === "high_usage" && (
                          <div className="text-[10px] text-gray-500">{alert.total_usage_MB} MB / {alert.limit_MB} MB limit</div>
                        )}
                        {alert.type === "blacklist" && (
                          <div className="text-[10px] text-gray-500">Site: {alert.site}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {TYPE_LABEL[alert.type] || alert.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PCPopupWindow;