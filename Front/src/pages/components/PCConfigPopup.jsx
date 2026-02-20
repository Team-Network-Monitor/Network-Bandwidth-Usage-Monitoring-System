import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { addMac, removeMac } from "../../redux/pcsSlice";
import pcImage from "./assets/pciamge.png";
import axios from "axios";

const BASE = "http://127.0.0.1:5000";

const PCConfigPopup = ({ selectedId }) => {
  const dispatch = useDispatch();
  const selectedPC = useSelector((state) =>
    state.pcs.pcs.find((pc) => pc.id === selectedId)
  );

  const isAssigned = selectedPC?.mac && selectedPC.mac !== "00:00:00:00:00:00";
  const [macInput, setMacInput] = useState(isAssigned ? selectedPC.mac : "");
  const [macSaved, setMacSaved] = useState(false);
  const [macError, setMacError] = useState("");

  useEffect(() => {
    setMacInput(isAssigned ? selectedPC.mac : "");
    setMacSaved(false);
    setMacError("");
  }, [selectedPC?.mac]);

  const isValidMac = (mac) =>
    /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac);

  const handleSave = () => {
    if (!isValidMac(macInput)) {
      setMacError("Invalid format: xx:xx:xx:xx:xx:xx");
      return;
    }
    dispatch(addMac({ id: selectedId, mac: macInput.toLowerCase() }));
    setMacSaved(true);
    setMacError("");
    setTimeout(() => setMacSaved(false), 2000);
  };

  const handleClear = async () => {
    const currentMac = selectedPC?.mac;
    dispatch(removeMac({ id: selectedId }));
    if (currentMac && currentMac !== "00:00:00:00:00:00") {
      try {
        await axios.post(`${BASE}/delete_mac`, { mac: currentMac });
      } catch (err) {
        console.error("Failed to delete MAC:", err);
      }
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-center text-3xl font-black text-blue-500 mb-2">{selectedId}</h1>

      <div className="relative mb-3">
        <img src={pcImage} alt="PC" width="110px" className="m-auto opacity-90" />
        <div className={`absolute bottom-0 right-[calc(50%-50px)] h-3 w-3 rounded-full border-2 border-white ${isAssigned ? "bg-green-400" : "bg-gray-400"}`} />
      </div>

      <div className="text-center mb-4">
        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Current MAC</span>
        <div className={`font-mono text-sm mt-1 px-3 py-1 rounded-lg inline-block border ${
          isAssigned ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-400"
        }`}>
          {selectedPC?.mac || "Not assigned"}
        </div>
      </div>

      <div className="mx-4">
        <label className="block text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">
          Assign MAC Address
        </label>
        <input
          type="text"
          value={macInput}
          onChange={(e) => { setMacInput(e.target.value); setMacSaved(false); setMacError(""); }}
          placeholder="xx:xx:xx:xx:xx:xx"
          className="w-full font-mono text-sm border-2 border-blue-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        />
        {macError && <p className="text-red-500 text-xs mt-1">{macError}</p>}

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all"
          >
            {macSaved ? "✓ Saved!" : "Save"}
          </button>
          {isAssigned && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-600 text-sm font-bold hover:bg-red-200 border border-red-300 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PCConfigPopup;