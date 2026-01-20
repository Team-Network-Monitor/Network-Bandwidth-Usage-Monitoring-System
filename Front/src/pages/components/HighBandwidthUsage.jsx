// HighBandwidthUsage.js
export default function HighBandwidthUsage({ pcs }) {
  return (
    <div className="p-2 border-2 border-blue-500 rounded-lg">
      <h2 className="font-bold text-center text-lg text-blue-500">
        High Bandwidth Usage PCs
      </h2>
      <ul>
        {pcs.map((pc, index) => (
          <li
            key={index}
            className="p-2 bg-blue-400 rounded-md my-1 text-blue-900 flex justify-between"
          >
            <span>{pc.id}</span>
            <span className="bg-blue-900 text-white px-2 rounded-full">
              {pc.usage} KB
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
