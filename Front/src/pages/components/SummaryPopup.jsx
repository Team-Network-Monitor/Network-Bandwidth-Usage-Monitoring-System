import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";

const SummaryPopup = () => {
  const pcs = useSelector((state) => state.pcs.pcs);
  const [summaryData, setSummaryData] = useState([]);
  const [error, setError] = useState(null);

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let index = 0;

    while (bytes >= 1024 && index < units.length - 1) {
      bytes /= 1024;
      index++;
    }

    return `${bytes.toFixed(2)} ${units[index]}`;
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/data");
        const data = response.data;
        const totals = [];

        pcs.forEach((pc) => {
          const macData = data[pc.mac];
          if (macData) {
            let total = 0;
            Object.values(macData).forEach((ipData) => (total += ipData.bytes));
            totals.push({ id: pc.id, totalBytes: total });
          } else {
            totals.push({ id: pc.id, totalBytes: 0 });
          }
        });

        totals.sort((a, b) => b.totalBytes - a.totalBytes);
        setSummaryData(totals);
        setError(null);
      } catch (err) {
        setError("Error fetching data");
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [pcs]);

  return (
    <div>
      <h2 className="text-center text-2xl font-bold mb-4">PC Bandwidth Summary</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">PC Name</th>
            <th className="border border-gray-300 px-4 py-2">Total Bandwidth</th>
          </tr>
        </thead>
        <tbody>
          {summaryData.map((pc) => (
            <tr key={pc.id} className="text-center">
              <td className="border border-gray-300 px-4 py-2">{pc.id}</td>
              <td className="border border-gray-300 px-4 py-2">{formatBytes(pc.totalBytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SummaryPopup;
