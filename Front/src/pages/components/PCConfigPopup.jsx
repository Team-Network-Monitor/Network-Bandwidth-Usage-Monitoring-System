import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { addMac, removeMac } from "../../redux/pcsSlice";
import pcImage from "./assets/pciamge.png";
import axios from "axios";

const BASE = "http://127.0.0.1:5000";
const mono = "'JetBrains Mono', monospace";

const PCConfigPopup = ({ selectedId }) => {
  const dispatch   = useDispatch();
  const allPCs     = useSelector((state) => state.pcs.pcs);
  const selectedPC = useSelector((state) =>
    state.pcs.pcs.find((pc) => pc.id === selectedId)
  );

  const isAssigned = selectedPC?.mac && selectedPC.mac !== "00:00:00:00:00:00";
  const [macInput,   setMacInput]   = useState(isAssigned ? selectedPC.mac : "");
  const [macSaved,   setMacSaved]   = useState(false);
  const [macError,   setMacError]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const pcNumber = parseInt(selectedId.match(/\d+$/)?.[0] ?? "", 10);

  useEffect(() => {
    setMacInput(isAssigned ? selectedPC.mac : "");
    setMacSaved(false);
    setMacError("");
    setAutoFilled(false);
    setSuggestion(null);
  }, [selectedPC?.mac, selectedId, isAssigned]);

  useEffect(() => {
    if (isAssigned) return;
    if (isNaN(pcNumber)) return;

    const fetchSuggestion = async () => {
      try {
        const res    = await axios.get(`${BASE}/data`);
        const agents = res.data;

        for (const [mac, agent] of Object.entries(agents)) {
          const ip = agent.ip;
          if (!ip || ip === "Unknown") continue;

          const lastOctet = parseInt(ip.split(".").pop(), 10);
          const derivedPC = lastOctet % 100 || 100;

          if (derivedPC !== pcNumber) continue;

          const conflict = allPCs.find(
            (pc) => pc.mac === mac && pc.id !== selectedId
          );
          if (conflict) continue;

          setSuggestion({ mac, ip, hostname: agent.hostname });
          setMacInput((prev) => {
            if (!prev) { setAutoFilled(true); return mac; }
            return prev;
          });
          return;
        }
      } catch (err) {
        console.error("Auto-fill failed:", err);
      }
    };

    fetchSuggestion();
    const id = setInterval(fetchSuggestion, 5000);
    return () => clearInterval(id);
  }, [selectedId, isAssigned, pcNumber, allPCs]);

  const isValidMac = (mac) =>
    /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac);

  const handleSave = async () => {
    const trimmed = macInput.trim().toLowerCase();
    if (!isValidMac(trimmed)) {
      setMacError("Invalid format — expected xx:xx:xx:xx:xx:xx");
      return;
    }
    const conflict = allPCs.find(
      (pc) => pc.mac === trimmed && pc.id !== selectedId
    );
    if (conflict) {
      setMacError(`Already assigned to ${conflict.id}`);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE}/add_mac`, { mac: trimmed });
      dispatch(addMac({ id: selectedId, mac: trimmed }));
      setMacSaved(true);
      setMacError("");
      setAutoFilled(false);
      setTimeout(() => setMacSaved(false), 2000);
    } catch {
      setMacError("Failed to save MAC to server");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    const currentMac = selectedPC?.mac;
    setLoading(true);
    try {
      if (currentMac && currentMac !== "00:00:00:00:00:00") {
        await axios.post(`${BASE}/delete_mac`, { mac: currentMac });
      }
      dispatch(removeMac({ id: selectedId }));
      setMacInput("");
      setMacSaved(false);
      setSuggestion(null);
      setAutoFilled(false);
    } catch {
      setMacError("Failed to remove MAC from server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: mono, color: "#e2e8f0", padding: "20px" }}>

      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#00c2ff" }}>
          {selectedId}
        </span>
      </div>

      <div style={{ position: "relative", width: "100px", margin: "0 auto 16px" }}>
        <img
          src={pcImage}
          alt="PC"
          style={{
            width: "100%",
            opacity: isAssigned ? 1 : 0.4,
            filter: isAssigned ? "none" : "grayscale(80%)",
          }}
        />
        <div style={{
          position: "absolute", bottom: 0, right: "10px",
          width: "12px", height: "12px", borderRadius: "50%",
          background: isAssigned ? "#00ffb2" : "#4a5580",
          border: "2px solid #080b14",
          boxShadow: isAssigned ? "0 0 6px #00ffb2" : "none",
        }} />
      </div>

      <div style={{
        textAlign: "center", marginBottom: "16px",
        background: "#141828", border: "1px solid #1e2540",
        borderRadius: "8px", padding: "10px 16px",
      }}>
        <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
          Current MAC
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: isAssigned ? "#00c2ff" : "#4a5580" }}>
          {selectedPC?.mac || "Not assigned"}
        </div>
      </div>

      {suggestion && !isAssigned && (
        <div style={{
          background: "#00ffb211", border: "1px solid #00ffb244",
          borderRadius: "8px", padding: "10px 14px", marginBottom: "12px",
          fontSize: "11px",
        }}>
          <div style={{ color: "#00ffb2", fontWeight: 700, marginBottom: "4px" }}>
            ● Agent detected
          </div>
          <div style={{ color: "#4a5580" }}>
            IP: <span style={{ color: "#e2e8f0" }}>{suggestion.ip}</span>
            {suggestion.hostname && suggestion.hostname !== "Unknown" && (
              <>&nbsp;·&nbsp; Host: <span style={{ color: "#e2e8f0" }}>{suggestion.hostname}</span></>
            )}
          </div>
          <div style={{ color: "#4a5580", marginTop: "2px" }}>
            MAC: <span style={{ color: "#00c2ff" }}>{suggestion.mac}</span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ fontSize: "10px", color: "#4a5580", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Assign MAC Address
          </div>
          {autoFilled && (
            <div style={{ fontSize: "10px", color: "#00ffb2", fontWeight: 600 }}>AUTO-FILLED</div>
          )}
        </div>
        <input
          type="text"
          value={macInput}
          onChange={(e) => {
            setMacInput(e.target.value);
            setMacSaved(false);
            setMacError("");
            setAutoFilled(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="xx:xx:xx:xx:xx:xx"
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px",
            background: autoFilled ? "#00ffb211" : "#141828",
            border: `1px solid ${macError ? "#ff4f6a" : autoFilled ? "#00ffb244" : "#1e2540"}`,
            color: "#e2e8f0", fontFamily: mono, fontSize: "12px",
            outline: "none", boxSizing: "border-box",
          }}
        />
        {macError && (
          <div style={{ fontSize: "11px", color: "#ff4f6a", marginTop: "4px" }}>{macError}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            flex: 1, padding: "9px", borderRadius: "6px", border: "none",
            background: macSaved ? "#00ffb2" : "#00c2ff",
            color: "#080b14", fontFamily: mono, fontSize: "12px",
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1, transition: "background 0.2s",
          }}
        >
          {macSaved ? "✓ SAVED" : "SAVE"}
        </button>

        {isAssigned && (
          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              padding: "9px 16px", borderRadius: "6px",
              background: "#ff4f6a22", border: "1px solid #ff4f6a55",
              color: "#ff4f6a", fontFamily: mono, fontSize: "12px",
              fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            CLEAR
          </button>
        )}
      </div>

    </div>
  );
};

export default PCConfigPopup;