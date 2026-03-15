import React, { useEffect, useState } from "react";
import PCItem from "./PCItem";
import axios from "axios";

const PCsStatus = ({ mockPCs, selectedLab, filteredPCs, noOfRows, setClicked }) => {
  const [error,     setError]     = useState("");
  const [macStatus, setMacStatus] = useState({});
  const [macFlags,  setMacFlags]  = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeRes, blacklistRes, limitRes] = await Promise.all([
          axios.get("http://127.0.0.1:5000/active_status"),
          axios.get("http://127.0.0.1:5000/check_blacklist"),
          axios.get("http://127.0.0.1:5000/check_limit"),
        ]);

        setMacStatus(activeRes.data);

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

  const getActive        = (pc) => macStatus[pc.mac]?.is_active        ?? false;
  const getHostname      = (pc) => macStatus[pc.mac]?.hostname          ?? pc.id;
  const getBlacklisted   = (pc) => macFlags[pc.mac]?.accessed_blacklist ?? false;
  const getLimitExceeded = (pc) => macFlags[pc.mac]?.limit_exceeded     ?? false;

  const enrich = (pc) => ({ ...pc, hostname: getHostname(pc) });

  const renderGroup = (group, index) => (
    <div key={index} style={{ margin: "0 8px 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" }}>
        {group.map((pc, i) => (
          <PCItem
            key={i}
            pc={enrich(pc)}
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
        pcs.slice(0,  25),
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
      const groups = [pcs.slice(0, 25), pcs.slice(25, 50)];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
          {groups.map((group, index) => renderGroup(group, index))}
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
        {row.map((pc, i) => (
          <PCItem
            key={i}
            pc={enrich(pc)}
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
    <div style={{
      background: "#0e1221",
      border: "1px solid #1e2540",
      borderRadius: "10px",
      width: "100%",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid #1e2540",
        background: "#141828",
        borderRadius: "10px 10px 0 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "13px",
          fontWeight: 700,
          color: "#e2e8f0",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          PC Status
        </span>

        {error && (
          <span style={{ fontSize: "11px", color: "#ff4f6a" }}>{error}</span>
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: "16px" }}>
        {renderPCsGrid(filteredPCs)}
      </div>
    </div>
  );
};

export default PCsStatus;