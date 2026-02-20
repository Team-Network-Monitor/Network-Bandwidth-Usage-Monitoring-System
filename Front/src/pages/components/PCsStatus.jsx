import React, { useEffect, useState } from "react";
import PCItem from "./PCItem";
import axios from "axios";

const PCsStatus = ({
  mockPCs,
  selectedLab,
  filteredPCs,
  noOfRows,
  setClicked,
}) => {
  const [error, setError] = useState("");
  const [macStatus, setMacStatus] = useState({});       // active_status
  const [macFlags, setMacFlags] = useState({});          // merged blacklist + limit per mac

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeRes, blacklistRes, limitRes] = await Promise.all([
          axios.get("http://127.0.0.1:5000/active_status"),
          axios.get("http://127.0.0.1:5000/check_blacklist"),
          axios.get("http://127.0.0.1:5000/check_limit"),
        ]);

        setMacStatus(activeRes.data);

        // Build a per-mac flags map from the two array responses
        const flags = {};

        blacklistRes.data.forEach(({ mac, accessed_blacklist }) => {
          if (!flags[mac]) flags[mac] = {};
          flags[mac].accessed_blacklist = accessed_blacklist;
        });

        limitRes.data.forEach(({ mac, exceeded }) => {
          if (!flags[mac]) flags[mac] = {};
          flags[mac].limit_exceeded = exceeded;
        });

        setMacFlags(flags);
      } catch (err) {
        setError("Error fetching data");
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getActive = (pc) =>
    macStatus[pc.mac]?.is_active ?? false;

  const getBlacklisted = (pc) =>
    macFlags[pc.mac]?.accessed_blacklist ?? false;

  const getLimitExceeded = (pc) =>
    macFlags[pc.mac]?.limit_exceeded ?? false;

  const renderGroup = (group, index) => (
    <div key={index} className="mx-3 mb-2">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "5px",
        }}
      >
        {group.map((pc, i) => (
          <PCItem
            key={i}
            pc={pc}
            setClicked={setClicked}
            active={getActive(pc)}
            restricted={getBlacklisted(pc)}
            limitExceeded={getLimitExceeded(pc)}
          />
        ))}
      </div>
    </div>
  );

  const renderPCsGrid = (pcs) => {
    if (selectedLab === "All") {
      const groups = [
        pcs.slice(0, 25),
        pcs.slice(25, 50),
        pcs.slice(50, 75),
        pcs.slice(75, 100),
      ];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {groups.map((group, index) => renderGroup(group, index))}
        </div>
      );
    }

    if (selectedLab === "CSL3" || selectedLab === "CSL4") {
      const groups = [
        pcs.slice(0, 25),
        pcs.slice(25, 50),
      ];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
          {groups.map((group, index) => renderGroup(group, index))}
        </div>
      );
    }

    // Single-row labs (CSL3.1, CSL3.2, CSL4.1, CSL4.2)
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
        {row.map((pc, i) => (
          <PCItem
            key={i}
            pc={pc}
            setClicked={setClicked}
            active={getActive(pc)}
            restricted={getBlacklisted(pc)}
            limitExceeded={getLimitExceeded(pc)}
          />
        ))}
      </div>
    ));
  };

  return (
    <div className="bg-slate-200 rounded-lg w-full">
      <div className="text-center py-4">
        <h2 className="text-lg font-bold text-blue-500 mb-3">PC Status</h2>
        {renderPCsGrid(filteredPCs)}
      </div>
    </div>
  );
};

export default PCsStatus;