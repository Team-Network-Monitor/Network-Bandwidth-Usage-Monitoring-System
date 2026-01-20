import React, { useEffect, useState } from "react";
import PCItem from "./PCItem";
import axios from "axios";

const PCsStatus = ({
  mockPCs,
  mockNetworkActivity,
  mockHighBandwidth,
  selectedLab,
  filteredPCs,
  noOfRows,
  setClicked,
}) => {
  const [error, setError] = useState("");
  const [macStatus, setMacStatus] = useState({});

  useEffect(() => {
    // Function to fetch data from the server
    const fetchData = async () => {
      // setIsLoading(true);
      try {
        const response = await axios.get(`http://127.0.0.1:5000/active_status`);
        setMacStatus(response.data);
        console.log("$$$$$$$$$$$$$$$$$$$, : ", response.data);
        // setIsLoading(false);
      } catch (err) {
        setError("Error fetching data");
        console.error(err);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderPCsGrid = (pcs) => {
    if (selectedLab === "All") {
      const groupedPCs = [
        pcs.slice(0, 25),
        pcs.slice(25, 50),
        pcs.slice(50, 75),
        pcs.slice(75, 100),
      ];

      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {groupedPCs.map((group, index) => (
            <div key={index} className="mx-3 mb-2">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(5, 1fr)`,
                  gap: "5px",
                }}
              >
                {group.map((pc, index) => (
                  <PCItem
                    key={index}
                    pc={pc}
                    setClicked={setClicked}
                    active={
                      macStatus[pc.mac] === undefined
                        ? false
                        : macStatus[pc.mac].is_active
                    }
                    restricted={
                      macStatus[pc.mac] === undefined
                        ? false
                        : macStatus[pc.mac].accessed_blacklist
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (selectedLab === "CSL3" || selectedLab === "CSL4") {
      const groupedPCs = [
        pcs.slice(0, 25),
        pcs.slice(25, 50),
        pcs.slice(50, 75),
        pcs.slice(75, 100),
      ];

      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
          {groupedPCs.map((group, index) => (
            <div key={index} className="mx-3 mb-2">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(5, 1fr)`,
                  gap: "5px",
                }}
              >
                {group.map((pc) => (
                  <PCItem
                    pc={pc}
                    setClicked={setClicked}
                    active={
                      macStatus[pc.mac] === undefined
                        ? false
                        : macStatus[pc.mac].is_active
                    }
                    restricted={
                      macStatus[pc.mac] === undefined
                        ? false
                        : macStatus[pc.mac].accessed_blacklist
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const rows = [];
    for (let i = 0; i < pcs.length; i += 5) {
      rows.push(pcs.slice(i, i + 5));
    }

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
        {row.map((pc) => (
          <PCItem
            pc={pc}
            setClicked={setClicked}
            active={
              macStatus[pc.mac] === undefined
                ? false
                : macStatus[pc.mac].is_active
            }
            restricted={
              macStatus[pc.mac] === undefined
                ? false
                : macStatus[pc.mac].accessed_blacklist
            }
          />
        ))}
      </div>
    ));
  };

  return (
    <div className=" bg-slate-200 rounded-md w-full rounded-lg">
      <div className="text-center py-4">
        <h2 className="text-lg font-bold text-blue-500 mb-3">PC Status</h2>
        {renderPCsGrid(filteredPCs)}
      </div>
    </div>
  );
};

export default PCsStatus;
