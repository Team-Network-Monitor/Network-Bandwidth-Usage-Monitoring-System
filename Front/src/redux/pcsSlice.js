import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";

// Load PCs from localStorage or initialize default state
const loadPCsFromStorage = () => {
  const storedData = localStorage.getItem("pcs");
  return storedData
    ? JSON.parse(storedData)
    : Array.from({ length: 100 }, (_, index) => ({
        id: `PC-${index + 1}`,
        mac: "00:00:00:00:00:00",
        status:
          Math.random() > 0.8
            ? "disconnected"
            : Math.random() > 0.6
            ? "restricted"
            : "active",
      }));
};

const initialState = {
  pcs: loadPCsFromStorage(),
};

const savePCsToStorage = (pcs) => {
  localStorage.setItem("pcs", JSON.stringify(pcs));
};

const sendMacToBackend = async (mac) => {
  try {
    await axios.post("http://127.0.0.1:5000/add_mac", { mac });
  } catch (error) {
    console.error("Failed to send MAC to backend:", error);
  }
};

const pcsSlice = createSlice({
  name: "pcs",
  initialState,
  reducers: {
    updatePC: (state, action) => {
      const { id, updatedData } = action.payload;
      const pcIndex = state.pcs.findIndex((pc) => pc.id === id);
      if (pcIndex !== -1) {
        state.pcs[pcIndex] = { ...state.pcs[pcIndex], ...updatedData };
        savePCsToStorage(state.pcs);
      } else {
        console.error("PC not found for update");
      }
    },
    addMac: (state, action) => {
      const obj = state.pcs.find((pc) => pc.id === action.payload.id);
      if (obj) {
        obj.mac = action.payload.mac;
        savePCsToStorage(state.pcs);
        sendMacToBackend(action.payload.mac);
      }
    },
  },
});

export const getMacs = (state) => state.pcs.pcs;

export const { updatePC, addMac } = pcsSlice.actions;
export default pcsSlice.reducer;
