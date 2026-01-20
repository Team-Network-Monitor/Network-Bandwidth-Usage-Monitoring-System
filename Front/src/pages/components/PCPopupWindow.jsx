import React, { useEffect, useState, useRef } from "react";
import pcImage from "./assets/pciamge.png";
import { BiEditAlt } from "react-icons/bi";
import { useSelector } from "react-redux";
import axios from "axios";

const PCPopupWindow = ({ selectedId, mockNetworkActivity, openModal2 }) => {
  const allPCs = useSelector((state) => state.pcs.pcs);
  const selectedPC = allPCs.find((pc) => pc.id === selectedId);

  const [macData, setMacData] = useState(null);
  const [error, setError] = useState(null);
  
  // --- Bandwidth Logic States ---
  const [bandwidth, setBandwidth] = useState("0 B/s");
  const lastBytesRef = useRef(0); // Using ref to persist last byte count without triggering re-renders
  const FETCH_INTERVAL = 3000; // Reduced to 3s for more "live" bandwidth feel

  function formatBytes(bytes, isSpeed = false) {
    if (bytes === 0) return isSpeed ? "0 B/s" : "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let index = 0;
    while (bytes >= 1024 && index < units.length - 1) {
      bytes /= 1024;
      index++;
    }
    return `${bytes.toFixed(2)} ${units[index]}${isSpeed ? "/s" : ""}`;
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/data/${selectedPC.mac}`
        );
        
        const currentTotal = response.data.total_bytes;

        // Calculate Bandwidth: (Current Total - Last Total) / Time
        if (lastBytesRef.current > 0) {
          const diff = currentTotal - lastBytesRef.current;
          const speed = diff / (FETCH_INTERVAL / 1000); // Bytes per second
          setBandwidth(formatBytes(speed, true));
        }

        setMacData(response.data);
        lastBytesRef.current = currentTotal; // Update reference for next fetch
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
      lastBytesRef.current = 0; // Reset when closing/changing PC
    };
  }, [selectedPC.mac]);

  return (
    <div className="p-4">
      <h1 className="text-center text-4xl font-black text-blue-500 mb-2">
        {selectedId}
      </h1>
      
      <div className="relative group">
        <img src={pcImage} alt="PC" width="160px" className="m-auto opacity-90 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-10 bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full border border-blue-300">
           ID: {selectedPC.id}
        </div>
      </div>

      <div className="flex justify-center items-center text-blue-500 -mt-2 mb-4 gap-2">
        <h2 className="text-center text-xl font-bold font-mono bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
          {selectedPC.mac}
        </h2>
        <button 
          onClick={() => openModal2()} 
          className="text-xl p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-md"
        >
          <BiEditAlt />
        </button>
      </div>

      {/* --- BANDWIDTH & USAGE SUMMARY --- */}
      <div className="grid grid-cols-2 gap-3 mx-4 mb-4">
        <div className="bg-blue-600 rounded-xl p-3 text-white shadow-lg">
          <p className="text-blue-100 text-[10px] uppercase font-bold tracking-tighter">Live Bandwidth</p>
          <h3 className="text-xl font-black truncate">{bandwidth}</h3>
        </div>
        <div className="bg-white border-2 border-blue-600 rounded-xl p-3 text-blue-600">
          <p className="text-blue-400 text-[10px] uppercase font-bold tracking-tighter">Total Usage</p>
          <h3 className="text-xl font-black truncate">
            {!macData ? "0 B" : formatBytes(macData.total_bytes)}
          </h3>
        </div>
      </div>

      <div className="mx-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-blue-500 font-black uppercase text-xs tracking-wider">Top Destinations</h3>
          <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> LIVE
          </span>
        </div>

        <div className="border-t-2 border-blue-100 pt-2">
          <div className="overflow-y-auto h-40 pr-2 custom-scrollbar">
            {macData && macData[selectedPC.mac] ? (
              Object.keys(macData[selectedPC.mac]).map((ip) => {
                const item = macData[selectedPC.mac][ip];
                if (item.domain !== null) {
                  return (
                    <div key={ip} className="flex justify-between items-center bg-blue-50 border border-transparent hover:border-blue-300 rounded-lg p-2 mb-2 transition-all">
                      <div className="truncate text-blue-700 font-medium text-xs max-w-[140px]">
                        {item.domain}
                      </div>
                      <div className="font-mono text-[10px] text-blue-600 font-bold bg-white px-2 py-1 rounded border">
                        {formatBytes(item.bytes)}
                      </div>
                    </div>
                  );
                }
                return null;
              })
            ) : (
              <div className="text-center py-10 text-blue-300 italic text-sm">
                {error ? "Backend connection lost" : "Analyzing packets..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PCPopupWindow;