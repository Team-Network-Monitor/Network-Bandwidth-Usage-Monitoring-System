import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import { IoTrashBinSharp } from "react-icons/io5";
import pcImage from "./components/assets/pciamge.png";
import PCConfigPopup from "./components/PCConfigPopup";
import axios from "axios";
import { addToBlackList, deleteBlackList, getBlaclist, setInitialization } from "../redux/blackListSlice";

const BASE = "http://127.0.0.1:5000";

// ── Blacklist Section ─────────────────────────────────────────────────────────
const BlacklistSection = () => {
  const dispatch = useDispatch();
  const blacklistedDomains = useSelector(getBlaclist);
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState("");

  // Load existing blacklist from backend on mount
  useEffect(() => {
    const fetchBlacklist = async () => {
      try {
        const res = await axios.get(`${BASE}/blacklist/domain`);
        const domains = res.data?.domains || res.data || [];
        dispatch(setInitialization(domains));
      } catch (err) {
        console.error("Failed to fetch blacklist:", err);
      }
    };
    fetchBlacklist();
  }, []);

  const handleAdd = () => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) { setError("Enter a domain name"); return; }
    if (blacklistedDomains.includes(trimmed)) { setError("Already blacklisted"); return; }
    dispatch(addToBlackList(trimmed));
    setDomainInput("");
    setError("");
  };

  return (
    <div className="bg-white border border-red-200 rounded-xl p-4 mb-4">
      <h3 className="text-sm font-black text-red-500 uppercase tracking-wider mb-3">
        Blacklisted Domains
      </h3>

      {/* Add input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => { setDomainInput(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. chatgpt.com"
          className="flex-1 text-sm border-2 border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all"
        >
          Add
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      {/* Domain list */}
      <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
        {blacklistedDomains.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-4">No domains blacklisted yet.</p>
        ) : (
          blacklistedDomains.map((domain, index) => (
            <div key={index} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-sm text-red-700 font-mono">{domain}</span>
              <button
                onClick={() => dispatch(deleteBlackList(domain))}
                className="p-1.5 rounded-full bg-red-100 hover:bg-red-200 transition-all"
              >
                <IoTrashBinSharp color="red" size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── Inline PC tile for config (shows assigned vs unassigned) ──────────────────
const PCConfigItem = ({ pc, onClick }) => {
  const isAssigned = pc.mac && pc.mac !== "00:00:00:00:00:00";

  return (
    <div
      onClick={() => onClick(pc.id)}
      className={`border-4 hover:cursor-pointer p-1 rounded-md hover:opacity-80 transition-opacity ${
        isAssigned ? "border-blue-500" : "border-gray-300"
      }`}
    >
      <div
        className={`absolute px-[2px] rounded-br-md rounded-tl-md text-white text-[10px] font-bold ${
          isAssigned ? "bg-blue-500" : "bg-gray-400"
        }`}
      >
        {pc.id}
      </div>
      <img src={pcImage} alt="" />
    </div>
  );
};

// ── Grid renderer (mirrors PCsStatus layout) ──────────────────────────────────
const ConfigGrid = ({ pcs, selectedLab, noOfRows, onClickPC }) => {
  const renderGroup = (group, index) => (
    <div key={index} className="mx-3 mb-2">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" }}>
        {group.map((pc, i) => (
          <PCConfigItem key={i} pc={pc} onClick={onClickPC} />
        ))}
      </div>
    </div>
  );

  if (selectedLab === "All") {
    const groups = [pcs.slice(0, 25), pcs.slice(25, 50), pcs.slice(50, 75), pcs.slice(75, 100)];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {groups.map((g, i) => renderGroup(g, i))}
      </div>
    );
  }

  if (selectedLab === "CSL3" || selectedLab === "CSL4") {
    const groups = [pcs.slice(0, 25), pcs.slice(25, 50)];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
        {groups.map((g, i) => renderGroup(g, i))}
      </div>
    );
  }

  // Single-row labs
  const rows = [];
  for (let i = 0; i < pcs.length; i += 5) rows.push(pcs.slice(i, i + 5));
  return rows.map((row, rowIndex) => (
    <div
      key={rowIndex}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${noOfRows * 5}, 1fr)`,
        gap: "5px",
        marginTop: "10px",
      }}
    >
      {row.map((pc, i) => (
        <PCConfigItem key={i} pc={pc} onClick={onClickPC} />
      ))}
    </div>
  ));
};

// ── Global Usage Limit Section ────────────────────────────────────────────────
const GlobalLimitSection = () => {
  const [currentLimit, setCurrentLimit] = useState(null);
  const [limitInput, setLimitInput] = useState("");
  const [limitSaved, setLimitSaved] = useState(false);
  const [limitError, setLimitError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${BASE}/check_limit`);
        const entry = (res.data || [])[0];
        if (entry?.limit_MB) {
          setCurrentLimit(entry.limit_MB);
          setLimitInput(String(entry.limit_MB));
        }
      } catch (err) {
        console.error("Failed to fetch limit:", err);
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    const mb = parseFloat(limitInput);
    if (isNaN(mb) || mb <= 0) {
      setLimitError("Enter a valid MB value greater than 0");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE}/set_limit`, { mb });
      setCurrentLimit(mb);
      setLimitSaved(true);
      setLimitError("");
      setTimeout(() => setLimitSaved(false), 2000);
    } catch (err) {
      setLimitError("Failed to set limit");
    } finally {
      setLoading(false);
    }
  };

  const handleSetMax = async () => {
    setLoading(true);
    try {
      await axios.post(`${BASE}/set_limit`, { mb: 999999 });
      setCurrentLimit(999999);
      setLimitInput("999999");
      setLimitError("");
    } catch (err) {
      setLimitError("Failed to set max limit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-orange-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-orange-500 uppercase tracking-wider">
          Global Usage Limit
        </h3>
        <div className={`font-mono text-sm px-3 py-1 rounded-lg border ${
          currentLimit && currentLimit < 999999
            ? "bg-orange-50 border-orange-300 text-orange-700"
            : "bg-gray-100 border-gray-300 text-gray-400"
        }`}>
          {currentLimit
            ? currentLimit >= 999999 ? "Unlimited" : `${currentLimit} MB`
            : "Not set"}
        </div>
      </div>

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            type="number"
            min="1"
            value={limitInput}
            onChange={(e) => { setLimitInput(e.target.value); setLimitSaved(false); setLimitError(""); }}
            placeholder="Enter limit in MB (e.g. 500)"
            className="w-full text-sm border-2 border-orange-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
          />
          {limitError && <p className="text-red-500 text-xs mt-1">{limitError}</p>}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="py-2 px-4 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {limitSaved ? "✓ Saved!" : "Set Limit"}
        </button>
        <button
          onClick={handleSetMax}
          disabled={loading}
          className="py-2 px-4 rounded-lg bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 border border-gray-300 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          Set Max
        </button>
      </div>
    </div>
  );
};

// ── ConfigTab ─────────────────────────────────────────────────────────────────
const ConfigTab = ({ mockPCs, selectedLab, filteredPCs, noOfRows }) => {
  const allPCs = useSelector((state) => state.pcs.pcs);
  const [selectedId, setSelectedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Count assigned MACs in the current filtered set
  const assignedCount = filteredPCs.filter(
    (pc) => pc.mac && pc.mac !== "00:00:00:00:00:00"
  ).length;
  const totalCount = filteredPCs.length;

  const handleClickPC = (id) => {
    setSelectedId(id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedId(null);
  };

  const showPreviousPC = () => {
    const currentNumber = parseInt(selectedId.replace("PC-", ""), 10);
    if (!isNaN(currentNumber)) {
      const newNumber = currentNumber > 1 ? currentNumber - 1 : 100;
      setSelectedId(`PC-${newNumber}`);
    }
  };

  const showNextPC = () => {
    const currentNumber = parseInt(selectedId.replace("PC-", ""), 10);
    if (!isNaN(currentNumber)) {
      const newNumber = currentNumber < 100 ? currentNumber + 1 : 1;
      setSelectedId(`PC-${newNumber}`);
    }
  };

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm text-gray-500 font-semibold">
          <span className="text-blue-600 font-bold">{assignedCount}</span> / {totalCount} PCs assigned
        </div>
        <div className="w-48 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (assignedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* PC Config Grid */}
      <div className="bg-slate-200 rounded-lg w-full">
        <div className="text-center py-4">
          <h2 className="text-lg font-bold text-blue-500 mb-3">PC Configuration</h2>
          <ConfigGrid
            pcs={filteredPCs}
            selectedLab={selectedLab}
            noOfRows={noOfRows}
            onClickPC={handleClickPC}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-end mt-2 py-2 px-4 gap-8">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
          <span>MAC Assigned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 rounded-full"></div>
          <span>Not Assigned</span>
        </div>
      </div>

      {/* Global settings row */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <BlacklistSection />
        <GlobalLimitSection />
      </div>

      {/* Config Modal */}
      {isModalOpen && selectedId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative w-1/4 border-4 border-blue-500 bg-white rounded-lg pb-4">
            <button
              onClick={closeModal}
              className="absolute rounded-full h-6 w-6 right-2 top-1 text-red-500 text-3xl"
            >
              <IoIosCloseCircle />
            </button>
            <button
              onClick={showPreviousPC}
              className="absolute -left-16 top-1/2 transform -translate-y-1/2 text-white text-4xl"
            >
              <FaCircleChevronLeft />
            </button>
            <button
              onClick={showNextPC}
              className="absolute -right-16 top-1/2 transform -translate-y-1/2 text-white text-4xl"
            >
              <FaCircleChevronRight />
            </button>
            <PCConfigPopup selectedId={selectedId} onClose={closeModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;