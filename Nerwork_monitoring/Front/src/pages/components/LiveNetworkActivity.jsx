// LiveNetworkActivity.js
export default function LiveNetworkActivity({ activities }) {
    
  return (
    <div>
      <h2 className="text-center text-xl font-bold text-blue-500">
        Live Network Activity
      </h2>
      <div className="border-2 border-blue-400 rounded-lg mt-1 pb-2  m-auto">
        {/* <table className="w-[96%] m-auto">
          <thead className="text-blue-600">
            <tr>
              <th>Destination IP</th>
              <th># of PCs</th>
              <th>Usage (KB)</th>
            </tr>
          </thead>
          <tbody>
          {activities.map((activity, index) => (
              <tr
                key={index}
                className={`border-blue-500 border rounded-md mb-2 ${
                  activity.isRestricted ? "bg-red-200" : "bg-green-200"
                }`}
              >
                <td className="pl-2 py-2"><span className="border-b border-l border-t w-[100%] bg-red-200 border-red-600">{activity.ip}</span></td>
                <td className="text-center py-2">{activity.pcs}</td>
                <td className="text-right pr-2 py-2">{activity.usage}</td>
              </tr>
            ))}
          </tbody>
        </table> */}
        <div className="grid grid-cols-4 gap-2 text-blue-600 px-4 py-2">
          {/* Header Row */}
          <div className="font-semibold text-center col-span-2">Destination IP</div>
          <div className="font-semibold text-center"># of PCs</div>
          <div className="font-semibold text-right">Usage (KB)</div>
        </div>
        <div className="px-4 py-2">
          {activities.map((activity, index) => (
            <div
              key={index}
              className={`grid grid-cols-4 gap-2 items-center rounded-md mb-2 text-blue-500 ${
                activity.isRestricted ? "border-red-200 border-1" : "border-green-400 border-2"
              }`}
            >
              <div className="pl-2 py-2 col-span-2">{activity.ip}</div>
              <div className="text-center py-2">{activity.pcs}</div>
              <div className="text-right pr-2 py-2">{activity.usage}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
