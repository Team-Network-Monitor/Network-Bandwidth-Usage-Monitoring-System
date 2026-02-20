import React, { useState } from "react";
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import PCsStatus from "./components/PCsStatus";
import PCPopupWindow from "./components/PCPopupWindow";

const PCMonitorTab = ({ mockPCs, selectedLab, filteredPCs, noOfRows }) => {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const handleClickPC = (id) => {
    setSelectedId(id);
    setIsModelOpen(true);
  };

  const closeModal = () => {
    setIsModelOpen(false);
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
    <div className="w-[96vw] m-auto">
      {/* PC Grid */}
      <PCsStatus
        mockPCs={mockPCs}
        selectedLab={selectedLab}
        filteredPCs={filteredPCs}
        noOfRows={noOfRows}
        setClicked={handleClickPC}
      />

      {/* Legend */}
      <div className="flex justify-end mt-2 py-2 px-4 gap-8">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-red-500 rounded-full"></div>
          <span>Blacklist Accessed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-orange-500 rounded-full"></div>
          <span>Limit Exceeded</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-green-500 rounded-full"></div>
          <span>Active Normal Operation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-500 rounded-full"></div>
          <span>Disconnected PCs</span>
        </div>
      </div>

      {/* PC Detail Modal */}
      {isModelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative w-1/4 border-4 bg-white rounded-lg pb-4">
            <button
              onClick={closeModal}
              className="absolute rounded-full h-6 w-6 right-2 top-1 text-red-500 text-3xl"
            >
              <IoIosCloseCircle />
            </button>

            {selectedId && (
              <>
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
                <PCPopupWindow selectedId={selectedId} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PCMonitorTab;