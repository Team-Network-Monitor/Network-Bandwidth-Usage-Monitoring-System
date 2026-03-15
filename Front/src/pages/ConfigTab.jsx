import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import { IoTrashBinSharp } from "react-icons/io5";
import pcImage from "./components/assets/pciamge.png";
import PCConfigPopup from "./components/PCConfigPopup";
import axios from "axios";
import { addToBlackList, deleteBlackList, getBlaclist, setInitialization } from "../redux/blackListSlice";

const BASE  = "http://127.0.0.1:5000";
const mono  = "'JetBrains Mono', monospace";

// ── Blacklist Section ─────────────────────────────────────────────────────────
const BlacklistSection = () => {
  const dispatch           = useDispatch();
  const blacklistedDomains = useSelector(getBlaclist);
  const [domainInput, setDomainInput] = useState("");
  const [error,       setError]       = useState("");

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res     = await axios.get(`${BASE}/blacklist/domains`);
        const domains = res.data?.domains || [];
        dispatch(setInitialization(domains));
      } catch (err) {
        console.error("Failed to fetch blacklist:", err);
      }
    };
    fetch_();
  }, []);

  const handleAdd = async () => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed)                          { setError("Enter a domain name");  return; }
    if (blacklistedDomains.includes(trimmed)) { setError("Already blacklisted"); return; }
    try {
      await axios.post(`${BASE}/blacklist/domain`, { domains: [trimmed] });
      dispatch(addToBlackList(trimmed));
      setDomainInput("");
      setError("");
    } catch { setError("Failed to add domain"); }
  };

  const handleDelete = async (domain) => {
    try {
      await axios.post(`${BASE}/blacklist/domain/delete`, { domain });
      dispatch(deleteBlackList(domain));
    } catch { console.error("Failed to delete domain"); }
  };

  return (
    <div style={{ background: "#0e1221", border: "1px solid #ff4f6a44", borderRadius: "10px", padding: "16px 20px" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#ff4f6a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
        Blacklisted Domains
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input
          type="text"
          value={domainInput}
          onChange={(e) => { setDomainInput(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. youtube.com"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: "6px",
            background: "#141828", border: "1px solid #1e2540",
            color: "#e2e8f0", fontFamily: mono, fontSize: "12px",
            outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: "8px 16px", borderRadius: "6px", border: "none",
            background: "#ff4f6a", color: "#080b14",
            fontFamily: mono, fontSize: "12px", fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ADD
        </button>
      </div>

      {error && (
        <div style={{ fontSize: "11px", color: "#ff4f6a", marginBottom: "8px" }}>{error}</div>
      )}

      {/* Domain list */}
      <div style={{ maxHeight: "160px", overflowY: "auto" }}>
        {blacklistedDomains.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#4a5580", fontSize: "12px" }}>
            No domains blacklisted yet.
          </div>
        ) : (
          blacklistedDomains.map((domain, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 12px", borderBottom: "1px solid #1e2540",
              background: "#ff4f6a11",
            }}>
              <span style={{ fontSize: "12px", color: "#ff4f6a", fontFamily: mono }}>{domain}</span>
              <button
                onClick={() => handleDelete(domain)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4f6a", padding: "2px" }}
              >
                <IoTrashBinSharp size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── PC Config tile ────────────────────────────────────────────────────────────
const PCConfigItem = ({ pc, onClick }) => {
  const isAssigned = pc.mac && pc.mac !== "00:00:00:00:00:00";
  const border     = isAssigned ? "#00c2ff" : "#1e2540";

  return (
    <div
      onClick={() => onClick(pc.id)}
      style={{
        border: `3px solid ${border}`,
        borderRadius: "6px", padding: "4px",
        position: "relative", cursor: "pointer",
        background: "#0e1221",
        boxShadow: isAssigned ? `0 0 6px ${border}44` : "none",
        transition: "opacity 0.15s",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0,
        background: isAssigned ? "#00c2ff" : "#1e2540",
        color: "#080b14", fontSize: "9px", fontWeight: 700,
        fontFamily: mono, padding: "1px 5px",
        borderRadius: "3px 0 4px 0",
      }}>
        {pc.id}
      </div>
      <img src={pcImage} alt={pc.id} style={{ width: "100%", display: "block", opacity: isAssigned ? 1 : 0.4 }} />
    </div>
  );
};

// ── Config grid ───────────────────────────────────────────────────────────────
const ConfigGrid = ({ pcs, selectedLab, noOfRows, onClickPC }) => {
  const renderGroup = (group, index) => (
    <div key={index} style={{ margin: "0 8px 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" }}>
        {group.map((pc, i) => <PCConfigItem key={i} pc={pc} onClick={onClickPC} />)}
      </div>
    </div>
  );

  if (selectedLab === "All") {
    const groups = [pcs.slice(0,25), pcs.slice(25,50), pcs.slice(50,75), pcs.slice(75,100)];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {groups.map((g, i) => renderGroup(g, i))}
      </div>
    );
  }

  if (selectedLab === "CSL3" || selectedLab === "CSL4") {
    const groups = [pcs.slice(0,25), pcs.slice(25,50)];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
        {groups.map((g, i) => renderGroup(g, i))}
      </div>
    );
  }

  const rows = [];
  for (let i = 0; i < pcs.length; i += 5) rows.push(pcs.slice(i, i + 5));
  return rows.map((row, ri) => (
    <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${noOfRows * 5}, 1fr)`, gap: "5px", marginTop: "10px" }}>
      {row.map((pc, i) => <PCConfigItem key={i} pc={pc} onClick={onClickPC} />)}
    </div>
  ));
};

// ── Global Usage Limit Section ────────────────────────────────────────────────
const GlobalLimitSection = () => {
  const [currentLimit, setCurrentLimit] = useState(null);
  const [limitInput,   setLimitInput]   = useState("");
  const [limitSaved,   setLimitSaved]   = useState(false);
  const [limitError,   setLimitError]   = useState("");
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res   = await axios.get(`${BASE}/status`);
        const limit = res.data?.limit_MB;
        if (limit) { setCurrentLimit(limit); setLimitInput(String(limit)); }
      } catch (err) { console.error("Failed to fetch limit:", err); }
    };
    fetch_();
  }, []);

  const handleSave = async () => {
    const mb = parseFloat(limitInput);
    if (isNaN(mb) || mb <= 0) { setLimitError("Enter a valid MB value > 0"); return; }
    setLoading(true);
    try {
      await axios.post(`${BASE}/set_limit`, { mb });
      setCurrentLimit(mb);
      setLimitSaved(true);
      setLimitError("");
      setTimeout(() => setLimitSaved(false), 2000);
    } catch { setLimitError("Failed to set limit"); }
    finally { setLoading(false); }
  };

  const handleSetMax = async () => {
    setLoading(true);
    try {
      await axios.post(`${BASE}/set_limit`, { mb: 999999 });
      setCurrentLimit(999999);
      setLimitInput("999999");
    } catch { setLimitError("Failed to set max"); }
    finally { setLoading(false); }
  };

  const isUnlimited = currentLimit >= 999999;

  return (
    <div style={{ background: "#0e1221", border: "1px solid #ffaa0044", borderRadius: "10px", padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#ffaa00", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Global Usage Limit
        </div>
        <div style={{
          fontSize: "12px", fontFamily: mono, padding: "3px 10px",
          borderRadius: "20px", fontWeight: 600,
          background: isUnlimited ? "#4a558022" : "#ffaa0022",
          color:      isUnlimited ? "#4a5580"   : "#ffaa00",
          border:     `1px solid ${isUnlimited ? "#4a558055" : "#ffaa0055"}`,
        }}>
          {currentLimit ? (isUnlimited ? "Unlimited" : `${currentLimit} MB`) : "Not set"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <input
            type="number"
            min="1"
            value={limitInput}
            onChange={(e) => { setLimitInput(e.target.value); setLimitSaved(false); setLimitError(""); }}
            placeholder="Limit in MB (e.g. 500)"
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "6px",
              background: "#141828", border: "1px solid #1e2540",
              color: "#e2e8f0", fontFamily: mono, fontSize: "12px",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {limitError && <div style={{ fontSize: "11px", color: "#ff4f6a", marginTop: "4px" }}>{limitError}</div>}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: "8px 14px", borderRadius: "6px", border: "none",
            background: limitSaved ? "#00ffb2" : "#ffaa00",
            color: "#080b14", fontFamily: mono, fontSize: "12px",
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {limitSaved ? "✓ SAVED" : "SET LIMIT"}
        </button>

        <button
          onClick={handleSetMax}
          disabled={loading}
          style={{
            padding: "8px 14px", borderRadius: "6px",
            background: "#141828", border: "1px solid #1e2540",
            color: "#4a5580", fontFamily: mono, fontSize: "12px",
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            opacity: loading ? 0.5 : 1,
          }}
        >
          SET MAX
        </button>
      </div>
    </div>
  );
};

// ── ConfigTab ─────────────────────────────────────────────────────────────────
const ConfigTab = ({ mockPCs, selectedLab, filteredPCs, noOfRows }) => {
  const [selectedId,  setSelectedId]  = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const assignedCount = filteredPCs.filter((pc) => pc.mac && pc.mac !== "00:00:00:00:00:00").length;
  const totalCount    = filteredPCs.length;
  const pct           = totalCount > 0 ? (assignedCount / totalCount) * 100 : 0;

  const handleClickPC = (id) => { setSelectedId(id); setIsModalOpen(true); };
  const closeModal    = ()   => { setIsModalOpen(false); setSelectedId(null); };

  const showPreviousPC = () => {
    const idx = filteredPCs.findIndex((pc) => pc.id === selectedId);
    if (idx === -1) return;
    setSelectedId(filteredPCs[idx > 0 ? idx - 1 : filteredPCs.length - 1].id);
  };

  const showNextPC = () => {
    const idx = filteredPCs.findIndex((pc) => pc.id === selectedId);
    if (idx === -1) return;
    setSelectedId(filteredPCs[idx < filteredPCs.length - 1 ? idx + 1 : 0].id);
  };

  return (
    <div style={{ fontFamily: mono, color: "#e2e8f0" }}>

      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", color: "#4a5580" }}>
          <span style={{ color: "#00c2ff", fontWeight: 700 }}>{assignedCount}</span> / {totalCount} PCs assigned
        </span>
        <div style={{ width: "160px", height: "4px", background: "#1e2540", borderRadius: "2px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#00c2ff", borderRadius: "2px", transition: "width 0.3s" }} />
        </div>
      </div>

      {/* PC grid */}
      <div style={{ background: "#0e1221", border: "1px solid #1e2540", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px", textAlign: "center" }}>
          PC Configuration
        </div>
        <ConfigGrid pcs={filteredPCs} selectedLab={selectedLab} noOfRows={noOfRows} onClickPC={handleClickPC} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "20px", marginBottom: "16px", fontSize: "11px", color: "#4a5580" }}>
        {[
          { color: "#00c2ff", label: "MAC Assigned" },
          { color: "#1e2540", label: "Not Assigned" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Settings row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <BlacklistSection />
        <GlobalLimitSection />
      </div>

      {/* Config Modal */}
      {isModalOpen && selectedId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{ position: "relative", width: "400px" }}>

            <button
              onClick={showPreviousPC}
              style={{ position: "absolute", left: "-52px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#00c2ff", fontSize: "2.2rem" }}
            >
              <FaCircleChevronLeft />
            </button>

            <div style={{ background: "#080b14", border: "1px solid #1e2540", borderRadius: "10px", overflow: "hidden", position: "relative" }}>
              <button
                onClick={closeModal}
                style={{ position: "absolute", top: "10px", right: "12px", background: "none", border: "none", cursor: "pointer", color: "#ff4f6a", fontSize: "1.6rem", zIndex: 10 }}
              >
                <IoIosCloseCircle />
              </button>
              <PCConfigPopup selectedId={selectedId} onClose={closeModal} />
            </div>

            <button
              onClick={showNextPC}
              style={{ position: "absolute", right: "-52px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#00c2ff", fontSize: "2.2rem" }}
            >
              <FaCircleChevronRight />
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;