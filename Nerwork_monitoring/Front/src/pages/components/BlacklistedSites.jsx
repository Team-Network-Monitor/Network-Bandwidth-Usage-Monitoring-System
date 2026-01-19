import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { deleteBlackList, getBlaclist } from "../../redux/blackListSlice";
import { IoTrashBinSharp } from "react-icons/io5";

export default function BlacklistedSites({ sites }) {
  const dispatch = useDispatch();
  const blacklistedIPs = useSelector(getBlaclist);
  console.log("kfjlsdjflksj ", blacklistedIPs[0]);

  const handleDeleteBlackList = (domain) => {
    dispatch(deleteBlackList(domain));
  };
  return (
    <div className="p-2  mt-4 bg-slate-200 rounded-lg px-4">
      <h2 className="font-bold text-center text-lg text-blue-500 my-2 mb-3">
        Blacklisted Sites
      </h2>
      <ul>
        {/* {sites.map((site, index) => (
          <li
            key={index}
            className="p-2 bg-blue-400 rounded-md my-1 text-blue-900 flex justify-between"
          >
            <span>{site.name}</span>

            <span className="bg-blue-900 text-white px-2 rounded-full">
              {site.count}
            </span>
          </li>
        ))} */}
        {blacklistedIPs.length > 0 ? (
          blacklistedIPs.map((ip, index) => (
            <li
              key={index}
              className="p-2 bg-gray-300 rounded-md my-1 text-blue-900 flex justify-between items-center"
            >
              {/* <strong>Name:</strong> {ip.name}, <strong>IP:</strong> {ip.ip}, <strong>DNS:</strong> {ip.dns}, <strong>Restriction:</strong> {ip.restrictionType} */}
              <span>{ip}</span>

              <span
                className="bg-red-200/80 p-1.5 rounded-full cursor-pointer"
                onClick={() => handleDeleteBlackList(ip)}
              >
                {/* {ip.count} */}
                <IoTrashBinSharp color="red" />
              </span>
            </li>
          ))
        ) : (
          <p>No IPs blacklisted yet.</p>
        )}
      </ul>
    </div>
  );
}
