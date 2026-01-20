import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addMac, updatePC } from "../../redux/pcsSlice";

const UpdatePCForm = ({ selectedId, setSelectedId, closePopup }) => {
  const dispatch = useDispatch();
  const allPCs = useSelector((state) => state.pcs.pcs);
  const selectedPC = allPCs.find((pc) => pc.id === selectedId);

  const [formData, setFormData] = useState({
    id: selectedPC?.id || "", // If updating, keep the selected PC's id
    ip: selectedPC?.ip || "",
    mac: selectedPC?.mac || "",
    status: selectedPC?.status || "active", // Default status is 'active'
  });

  // Update form data when selectedPC changes
  useEffect(() => {
    if (selectedPC) {
      setFormData({
        id: selectedPC.id,
        ip: selectedPC.ip,
        mac: selectedPC.mac,
        status: selectedPC.status,
      });
    }
  }, [selectedPC]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedPC) {
      // Dispatch with all form data (ip, mac, status)
      dispatch(
        addMac({
          id: formData.id,
          mac: formData.mac,
          // status: formData.status,
        })
      );
    }

    // Reset the form after submit
    setFormData({ id: "", ip: "", mac: "", status: "active" });
    // setSelectedId(null); // Close the form
    closePopup(false);
  };

  // Simple form validation (example for IP and MAC address formats)
  const isValidIP = (ip) => {
    const regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  };

  const isValidMAC = (mac) => {
    const regex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    return regex.test(mac);
  };

  const isFormValid = () => {
    // return isValidIP(formData.ip) && isValidMAC(formData.mac);
    return isValidMAC(formData.mac);
  };

  return (
    <div>
      <h1 className="text-center text-3xl font-black text-blue-500 mt-4">
        {selectedPC ? `Update ${selectedPC.id}` : "Add New PC"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className=" text-sm grid  pt-8 px-5 gap-y-5 text-blue-500"
      >
        {/* <div className="flex justify-between">
          <label>IP Address:</label>
          <input
            type="text"
            name="ip"
            className="border-b-2 border-blue-500"
            placeholder="192.168.1.1"
            value={formData.ip}
            onChange={handleChange}
          />
        </div>
        {!formData.ip && formData.ip !== "" && (
          <span className="text-red-500 text-xs flex justify-end">
            IP address is required
          </span>
        )}
        {!isValidIP(formData.ip) && formData.ip && (
          <span className="text-red-500 text-xs flex justify-end">
            Invalid IP format
          </span>
        )} */}

        <div className="flex justify-between">
          <label>MAC Address:</label>
          <input
            type="text"
            name="mac"
            className="border-b-2 border-blue-500"
            placeholder="00:1A:2B:3C:4D:5E"
            value={formData.mac}
            onChange={handleChange}
          />
        </div>

        {!isValidMAC(formData.mac) && formData.mac && (
          <span className="text-red-500 text-xs flex justify-end">
            Invalid MAC format
          </span>
        )}
        <div className="flex justify-between">
          <label>Status:</label>
          <select name="status" value={formData.status} onChange={handleChange}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            {/* <option value="maintenance">Maintenance</option> */}
          </select>
        </div>

        <button
          className="bg-blue-500 text-white py-2 rounded-lg mt-10 hover:cursor-pointer"
          type="submit"
          disabled={!isFormValid()} // Disable the submit button if form is invalid
        >
          {selectedPC ? "Update PC" : "Add PC"}
        </button>
      </form>
    </div>
  );
};

export default UpdatePCForm;
