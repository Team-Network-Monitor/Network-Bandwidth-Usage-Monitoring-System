import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import BlacklistedSites from "./components/BlacklistedSites";
import LiveNetworkActivity from "./components/LiveNetworkActivity";
import HighBandwidthUsage from "./components/HighBandwidthUsage";
import { FaPlay, FaStop } from "react-icons/fa6";
import React from "react";
import PCsStatus from "./components/PCsStatus";
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import pcImage from "./components/assets/pciamge.png";
import { BiEditAlt } from "react-icons/bi";
import PCPopupWindow from "./components/PCPopupWindow";
import AddBlackListPopupWindow from "./AddBlackListPopupWindow";
import UpdatePCForm from "./components/UpdatePCForm";

const mockPCsa = Array.from({ length: 100 }, (_, i) => ({
  id: `PC-${i + 1}`,
  status:
    Math.random() > 0.8
      ? "disconnected"
      : Math.random() > 0.6
      ? "restricted"
      : "active",
}));



const mockNetworkActivity = [
  { ip: "lms.jfn.ac.lk", pcs: 89, usage: 75822 },
  { ip: "codeshare.io", pcs: 7, usage: 54621 },
  { ip: "chatgpt.com", pcs: 3, usage: 21648 },
  { ip: "gemini.com", pcs: 3, usage: 1463 },
];

const mockHighBandwidth = [
  { id: "PC-05", usage: 73414 },
  { id: "PC-61", usage: 47523 },
];

const blackList = [
  { name: "chatgpt", count: 7 },
  { name: "Gemini", count: 3 },
];

const labOptions = [
  { value: "All", label: "All: 100 PCs", row: 4 },
  { value: "CSL3", label: "CSL3: 1-50 PCs", row: 2 },
  { value: "CSL4", label: "CSL4: 51-100", row: 2 },
  { value: "CSL3.1", label: "CSL3.1: 1-25 PCs", row: 1 },
  { value: "CSL3.2", label: "CSL3.2: 26-50 PCs", row: 1 },
  { value: "CSL4.1", label: "CSL4.1: 51-75 PCs", row: 1 },
  { value: "CSL4.2", label: "CSL4.2: 76-100 PCs", row: 1 },
];

const NetworkDashboard = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [selectedLab, setSelectedLab] = useState("All");
  const pcsFromRedux = useSelector((state) => state.pcs.pcs);
  const [filteredPCs, setFilteredPCs] = useState(pcsFromRedux);
  const [noOfRows, setNoOfRows] = useState(4);
  const [isModelOpen, setIsModelOpen] = useState(null);
  const [isModel2Open, setIsModel2Open] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [isPCFormOpen, setIsPCFormOpen] = useState(false);



  console.log("hello", mockPCsa);

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

  useEffect(() => {
    switch (selectedLab) {
      case "All":
        setFilteredPCs(pcsFromRedux);
        setNoOfRows(4);
        break;
      case "CSL3":
        setFilteredPCs(pcsFromRedux.slice(0, 50));
        setNoOfRows(2);
        break;
      case "CSL4":
        setFilteredPCs(pcsFromRedux.slice(50, 100));
        setNoOfRows(2);
        break;
      case "CSL3.1":
        setFilteredPCs(pcsFromRedux.slice(0, 25));
        setNoOfRows(1);
        break;
      case "CSL3.2":
        setFilteredPCs(pcsFromRedux.slice(25, 50));
        setNoOfRows(1);
        break;
      case "CSL4.1":
        setFilteredPCs(pcsFromRedux.slice(50, 75));
        setNoOfRows(1);
        break;
      case "CSL4.2":
        setFilteredPCs(pcsFromRedux.slice(75, 100));
        setNoOfRows(1);
        break;
      default:
        setFilteredPCs(pcsFromRedux);
    }
  }, [selectedLab, pcsFromRedux]);
   

  const handleToggle = () => {
    setIsRunning(!isRunning);
    if (!isRunning) {
      setTimer(0); // Reset timer when starting
    }
  };

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const handleClickPC = (id) => {
    setSelectedId(id);
    setIsModelOpen(true);
  };

  const handleClickIpAddButton = () => {
    setIsModelOpen(true);
    setIsOpenForm(true);
  };

  const closeModal = () => {
    setIsModelOpen(false);
    setSelectedId(null);
    setIsOpenForm(false);
  };

  const closeModal2 = () => {
    setIsModel2Open(false);
    setIsPCFormOpen(false);
  };

  const openModal2 = () => {
    setIsModel2Open(true);
    setIsPCFormOpen(true);
  };

  const showPreviousPC = () => {
    // Extract the number from "PC-45"
    const currentNumber = parseInt(selectedId.replace("PC-", ""), 10);

    if (!isNaN(currentNumber)) {
      const newNumber = currentNumber > 1 ? currentNumber - 1 : 100;
      setSelectedId(`PC-${newNumber}`);
    }
  };

  const showNextPC = () => {
    // Extract the number from "PC-45"
    const currentNumber = parseInt(selectedId.replace("PC-", ""), 10);

    if (!isNaN(currentNumber)) {
      const newNumber = currentNumber < 100 ? currentNumber + 1 : 0;
      setSelectedId(`PC-${newNumber}`);
    }
  };

  return (
    <div>
      <header className="bg-blue-700 text-white pb-1 text-center">
        <h1 className="font-black text-3xl">Network Monitoring Dashboard</h1>
        <h2 className=" text-xl">DCS CSL3 & CSL4</h2>
      </header>

      <div className="text-xl justify-between flex w-[96vw]  m-auto h-12">
        <div className="ml-2 relative group  flex justify-center items-center self-center ">
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
            <div className="text-red-500 ml-2 font-bold">
              {formatTime(timer)}
            </div>
          )}
          {/* <FaPlay className="hover:cursor-pointer"  /> */}
          {/* "Start" text that appears on hover over the play button */}
          {/* <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 text-center text-sm opacity-0 group-hover:opacity-100  transition-opacity duration-300 mb-2">
            Start
          </span> */}
        </div>

        <div className="self-center">
          <input
            type="text"
            placeholder="Find PC..."
            className="px-2 py-[1px] text-lg border-blue-500 border-4 rounded-lg mx-1"
          />
          <select
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            className="px-2 py-1 mx-1 rounded-lg bg-blue-500 text-lg hover:cursor-pointer text-white"
          >
            {labOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="px-3 py-1 rounded-lg bg-green-500 text-white ml-1 mr-2 "
            onClick={() => handleClickIpAddButton()}
          >
            Add Blacklist
          </button>
        </div>
      </div>
      <div className="w-[96vw] m-auto">
        <PCsStatus
          mockPCs={pcsFromRedux}
          mockNetworkActivity={mockNetworkActivity}
          mockHighBandwidth={mockHighBandwidth}
          selectedLab={selectedLab}
          filteredPCs={filteredPCs}
          noOfRows={noOfRows}
          setClicked={handleClickPC}
        />
        <div className="grid grid-cols-4 gap-2 mt-2">
          <div className="">
            <BlacklistedSites sites={blackList} />
          </div>
          <div className="col-span-2">
            <LiveNetworkActivity activities={mockNetworkActivity} />
          </div>
          <div className="">
            <HighBandwidthUsage pcs={mockHighBandwidth} />
            <div className="py-2 px-14">
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-red-500 rounded-full"></div>{" "}
                <span>Restricted Activity</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-purple-500 rounded-full"></div>{" "}
                <span>High Data Usage</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-green-500 rounded-full"></div>{" "}
                <span>Active Normal Operation</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-gray-500 rounded-full"></div>{" "}
                <span>Disconnected PCs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative w-1/4  border-4 border-red-500 bg-white rounded-lg pb-4">
            <button
              onClick={closeModal}
              className="absolute rounded-full h-6 w-6 right-2 top-1 text-red-500 text-3xl"
            >
              <IoIosCloseCircle />
            </button>

            {selectedId && (
              <>
                {/* Navigation Buttons */}
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
                <PCPopupWindow
                  selectedId={selectedId}
                  mockNetworkActivity={mockNetworkActivity}
                  openModal2={openModal2}
                />
                {isModel2Open && (
                  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="relative w-1/4  border-4 border-red-500 bg-white rounded-lg pb-4">
                      <button
                        onClick={closeModal2}
                        className="absolute rounded-full h-6 w-6 right-2 top-1 text-red-500 text-3xl"
                      >
                        <IoIosCloseCircle />
                      </button>
                      <UpdatePCForm
                        selectedPC={selectedId}
                        setSelectedPC={setSelectedId}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {isOpenForm && (
              <>
                <AddBlackListPopupWindow />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkDashboard;
