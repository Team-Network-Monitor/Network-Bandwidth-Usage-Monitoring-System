import { useState, useEffect } from "react";

const mockPCs = Array.from({ length: 100 }, (_, i) => ({
  id: `PC-${i + 1}`,
  status:
    Math.random() > 0.8
      ? "disconnected"
      : Math.random() > 0.6
      ? "restricted"
      : "active",
}));

const labOptions = [
  { value: "All", label: "All: 100 PCs" },
  { value: "CSL3", label: "CSL3: 1-50 PCs" },
  { value: "CSL4", label: "CSL4: 51-100" },
  { value: "CSL3.1", label: "CSL3.1: 1-25 PCs" },
  { value: "CSL3.2", label: "CSL3.2: 26-50 PCs" },
  { value: "CSL4.1", label: "CSL4.1: 51-75 PCs" },
  { value: "CSL4.2", label: "CSL4.2: 76-100 PCs" },
];

export default function NetworkDashboard() {
  const [selectedLab, setSelectedLab] = useState("All");
  const [filteredPCs, setFilteredPCs] = useState(mockPCs);

  useEffect(() => {
    switch (selectedLab) {
      case "All":
        setFilteredPCs(mockPCs);
        break;
      case "CSL3":
        setFilteredPCs(mockPCs.slice(0, 50));
        break;
      case "CSL4":
        setFilteredPCs(mockPCs.slice(50, 100));
        break;
      case "CSL3.1":
        setFilteredPCs(mockPCs.slice(0, 25));
        break;
      case "CSL3.2":
        setFilteredPCs(mockPCs.slice(25, 50));
        break;
      case "CSL4.1":
        setFilteredPCs(mockPCs.slice(50, 75));
        break;
      case "CSL4.2":
        setFilteredPCs(mockPCs.slice(75, 100));
        break;
      default:
        setFilteredPCs(mockPCs);
    }
  }, [selectedLab]);

  // Function to render a batch of 25 PCs in a grid (4 columns, 5 rows)
  const renderPCsGrid = (pcs, startIndex = 0) => {
    const rows = [];
    const totalRows = 5; // 5 rows
    const totalColumns = 4; // 4 columns
    let currentRow = [];

    // Loop through the PCs and organize them into 5 rows with 4 columns
    for (let i = startIndex; i < pcs.length && rows.length < totalRows; i++) {
      if (currentRow.length < totalColumns) {
        currentRow.push(pcs[i]);
      }

      // When a row is filled, push it to rows and start a new row
      if (currentRow.length === totalColumns) {
        rows.push(currentRow);
        currentRow = [];
      }
    }

    // Render the rows
    return rows.map((row, rowIndex) => (
      <div
        key={rowIndex}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)", // 4 columns per row
          gap: "10px",
          marginTop: "10px",
        }}
      >
        {row.map((pc) => (
          <div
            key={pc.id}
            style={{
              padding: "10px",
              border: "1px solid",
              textAlign: "center",
              borderRadius: "5px",
              borderColor:
                pc.status === "restricted"
                  ? "red" // Always red for restricted PCs
                  : pc.status === "active"
                  ? "green"
                  : "gray",
              opacity: pc.status === "disconnected" ? 0.5 : 1,
            }}
          >
            {pc.id}
          </div>
        ))}
      </div>
    ));
  };

  const firstBatchPCs = filteredPCs.slice(0, 25);
  const secondBatchPCs = filteredPCs.slice(25, 50);

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#1E3A8A",
        color: "white",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px",
          backgroundColor: "#1E40AF",
          borderRadius: "8px",
        }}
      >
        <h1>Network Monitoring Dashboard</h1>
        <div>
          <select
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            style={{ padding: "5px", marginRight: "5px" }}
          >
            {labOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Find PC..."
            style={{ padding: "5px", marginRight: "5px" }}
          />
          <button style={{ marginRight: "5px", padding: "5px" }}>
            Add to Blacklist
          </button>
        </div>
      </header>

      <div
        style={{
          background: "#2E4A9E",
          padding: "10px",
          borderRadius: "8px",
          marginTop: "10px",
        }}
      >
        <h2>PC Status - First 25 PCs</h2>
        {renderPCsGrid(firstBatchPCs)}
      </div>

      <div
        style={{
          background: "#2E4A9E",
          padding: "10px",
          borderRadius: "8px",
          marginTop: "10px",
        }}
      >
        <h2>PC Status - Next 25 PCs</h2>
        {renderPCsGrid(secondBatchPCs, 25)}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginTop: "10px",
        }}
      >
        <div
          style={{
            background: "#2E4A9E",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <h2>Blacklisted Sites</h2>
          <ul>
            <li
              style={{
                padding: "5px",
                backgroundColor: "#374993",
                borderRadius: "5px",
              }}
            >
              codeshare.io (7)
            </li>
            <li
              style={{
                padding: "5px",
                backgroundColor: "#374993",
                borderRadius: "5px",
              }}
            >
              chatgpt.com (3)
            </li>
          </ul>
        </div>

        <div
          style={{
            background: "#2E4A9E",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <h2>Live Network Activity</h2>
          <table style={{ width: "100%", marginTop: "10px" }}>
            <thead>
              <tr>
                <th>Destination IP</th>
                <th># of PCs</th>
                <th>Usage (KB)</th>
              </tr>
            </thead>
            <tbody>{/* Sample data for live network activity */}</tbody>
          </table>
        </div>

        <div
          style={{
            background: "#2E4A9E",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <h2>High Bandwidth Usage PCs</h2>
          <ul>{/* Sample data for high bandwidth usage */}</ul>
        </div>
      </div>
    </div>
  );
}
