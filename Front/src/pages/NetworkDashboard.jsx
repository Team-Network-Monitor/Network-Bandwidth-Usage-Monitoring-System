import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { FaPlay, FaStop } from "react-icons/fa6";
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
  { value: "All", label: "All: 100 PCs" },
  { value: "CSL3", label: "CSL3: 1-50 PCs" },
  { value: "CSL4", label: "CSL4: 51-100" },
  { value: "CSL3.1", label: "CSL3.1: 1-25 PCs" },
  { value: "CSL3.2", label: "CSL3.2: 26-50 PCs" },
  { value: "CSL4.1", label: "CSL4.1: 51-75 PCs" },
  { value: "CSL4.2", label: "CSL4.2: 76-100 PCs" },
];

const NetworkDashboard = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [activeTab, setActiveTab] = useState("monitor");
  const [error, setError] = useState("");
  const [alertCount, setAlertCount] = useState(0);

  // Background poll to keep the tab badge count fresh
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:5000/alerts");
        setAlertCount(res.data.total_alerts || 0);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  const mockPCs = useSelector((state) => state.pcs.pcs);
  const [selectedLab, setSelectedLab] = useState("All");
  const [noOfRows, setNoOfRows] = useState(4);

  // Derived reactively from Redux — updates instantly when any PC's MAC changes
  const filteredPCs = useMemo(() => {
    switch (selectedLab) {
      case "CSL3":   return mockPCs.slice(0, 50);
      case "CSL4":   return mockPCs.slice(50, 100);
      case "CSL3.1": return mockPCs.slice(0, 25);
      case "CSL3.2": return mockPCs.slice(25, 50);
      case "CSL4.1": return mockPCs.slice(50, 75);
      case "CSL4.2": return mockPCs.slice(75, 100);
      default:       return mockPCs;
    }
  }, [mockPCs, selectedLab]);

  const handleLabChange = (value) => {
    setSelectedLab(value);
    switch (value) {
      case "CSL3":   setNoOfRows(2); break;
      case "CSL4":   setNoOfRows(2); break;
      case "CSL3.1": setNoOfRows(1); break;
      case "CSL3.2": setNoOfRows(1); break;
      case "CSL4.1": setNoOfRows(1); break;
      case "CSL4.2": setNoOfRows(1); break;
      default:       setNoOfRows(4); break;
    }
  };

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTimer((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const start = async () => {
    try {
      await axios.get(`http://127.0.0.1:5000/start`);
    } catch (err) {
      setError("Error start");
      console.error(err);
    }
  };

  const stop = async () => {
    try {
      await axios.get(`http://127.0.0.1:5000/stop`);
    } catch (err) {
      setError("Error stop");
      console.error(err);
    }
  };

  const handleToggle = () => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
    setIsRunning(!isRunning);
    if (!isRunning) {
      setTimer(0);
    }
  };

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-blue-700 text-white text-center py-4">
        <h1 className="font-black text-3xl">Network Monitoring Dashboard</h1>
        <h2 className="text-xl">DCS CSL3 & CSL4</h2>
      </header>

      {/* Top Bar: Start/Stop + Filter */}
      <div className="text-xl flex w-[96vw] m-auto py-4 pt-6 items-center justify-between">
        <div className="ml-2 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-md">
            {!isRunning ? (
              <FaPlay
                className="hover:cursor-pointer text-green-400"
                onClick={handleToggle}
              />
            ) : (
              <FaStop
                className="hover:cursor-pointer text-red-500"
                onClick={handleToggle}
              />
            )}
          </div>
          {isRunning && (
            <div className="text-red-500 font-bold">{formatTime(timer)}</div>
          )}
        </div>

        <select
          value={selectedLab}
          onChange={(e) => handleLabChange(e.target.value)}
          className="px-2 py-1 rounded-lg bg-blue-500 text-lg hover:cursor-pointer text-white"
        >
          {labOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tab Bar */}
      <div className="w-[96vw] m-auto">
        <div className="border-b border-gray-300">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 text-base font-semibold rounded-t-lg transition-colors duration-150 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white border border-b-0 border-blue-600"
                    : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                {tab.label}
                {tab.id === "alerts" && alertCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-[96vw] m-auto pt-4">
        {activeTab === "monitor" && (
          <PCMonitorTab
            mockPCs={mockPCs}
            selectedLab={selectedLab}
            filteredPCs={filteredPCs}
            noOfRows={noOfRows}
          />
        )}
        {activeTab === "alerts" && (
          <AlertsTab
            onAlertCount={setAlertCount}
            selectedLab={selectedLab}
          />
        )}
        {activeTab === "analysis" && (
          <AnalysisTab
            selectedLab={selectedLab}
            filteredPCs={filteredPCs}
          />
        )}
        {activeTab === "config" && (
          <ConfigTab
            mockPCs={mockPCs}
            selectedLab={selectedLab}
            filteredPCs={filteredPCs}
            noOfRows={noOfRows}
          />
        )}
      </div>
    </div>
  );
};

export default NetworkDashboard;