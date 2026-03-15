import React, { useState } from "react";
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import PCsStatus from "./components/PCsStatus";
import PCPopupWindow from "./components/PCPopupWindow";

const PCMonitorTab = ({ mockPCs, selectedLab, filteredPCs, noOfRows }) => {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [selectedId,  setSelectedId]  = useState(null);

  const handleClickPC = (id) => {
    setSelectedId(id);
    setIsModelOpen(true);
  };

  const closeModal = () => {
    setIsModelOpen(false);
    setSelectedId(null);
  };

  // Navigate within filteredPCs so prev/next stays in the current lab view
  const showPreviousPC = () => {
    const idx = filteredPCs.findIndex((pc) => pc.id === selectedId);
    if (idx === -1) return;
    const prev = filteredPCs[idx > 0 ? idx - 1 : filteredPCs.length - 1];
    setSelectedId(prev.id);
  };

  const showNextPC = () => {
    const idx = filteredPCs.findIndex((pc) => pc.id === selectedId);
    if (idx === -1) return;
    const next = filteredPCs[idx < filteredPCs.length - 1 ? idx + 1 : 0];
    setSelectedId(next.id);
  };

  return (
    <div style={{ width: "96vw", margin: "0 auto" }}>

      {/* PC Grid */}
      <PCsStatus
        mockPCs={mockPCs}
        selectedLab={selectedLab}
        filteredPCs={filteredPCs}
        noOfRows={noOfRows}
        setClicked={handleClickPC}
      />

      {/* Legend */}
      <div style={{
        display: "flex", justifyContent: "flex-end", gap: "24px",
        padding: "10px 16px", marginTop: "8px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#4a5580",
      }}>
        {[
          { color: "#f87171", label: "Blacklist Accessed" },
          { color: "#f97316", label: "Limit Exceeded" },
          { color: "#4ade80", label: "Active Normal" },
          { color: "#6b7280", label: "Disconnected" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModelOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{ position: "relative", width: "55vw", maxWidth: "900px" }}>

            {/* Prev button */}
            <button
              onClick={showPreviousPC}
              style={{
                position: "absolute", left: "-52px", top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "#00c2ff", fontSize: "2.2rem", lineHeight: 1,
              }}
            >
              <FaCircleChevronLeft />
            </button>

            {/* Modal card */}
            <div style={{
              background: "#080b14",
              border: "1px solid #1e2540",
              borderRadius: "10px",
              maxHeight: "88vh",
              overflowY: "auto",
              position: "relative",
            }}>
              {/* Close button */}
              <button
                onClick={closeModal}
                style={{
                  position: "absolute", top: "10px", right: "12px",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#ff4f6a", fontSize: "1.6rem", lineHeight: 1, zIndex: 10,
                }}
              >
                <IoIosCloseCircle />
              </button>

              {selectedId && <PCPopupWindow selectedId={selectedId} />}
            </div>

            {/* Next button */}
            <button
              onClick={showNextPC}
              style={{
                position: "absolute", right: "-52px", top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "#00c2ff", fontSize: "2.2rem", lineHeight: 1,
              }}
            >
              <FaCircleChevronRight />
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default PCMonitorTab;