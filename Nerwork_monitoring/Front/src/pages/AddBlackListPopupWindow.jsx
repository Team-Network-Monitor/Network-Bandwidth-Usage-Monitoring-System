import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { addToBlackList } from "../redux/blackListSlice";

const AddBlackListPopupWindow = () => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    name: "",
    ipv4: "",
    dns: "",
    restrictionType: "restricted",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(addToBlackList(formData.dns));
    console.log("New IP Added:", formData);
    setFormData({ name: "", ipv4: "", restrictionType: "restricted" });
  };

  return (
    <div>
      <h1 className="text-center text-3xl font-black text-blue-500 mt-4">
        Add Blacklist Domain
      </h1>

      <form
        action=""
        className="grid-cols-2 text-sm grid gap-y-4 pt-8 px-2 text-blue-500"
        onSubmit={handleSubmit}
      >
        {/* <label htmlFor="">Name (Label/Description) : </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="border-b-2 border-blue-500"
          placeholder="Chat GPT"
        /> */}

        {/* <label htmlFor="">IP Address : </label>
        <input
          name="ipv4"
          value={formData.ipv4}
          onChange={handleChange}
          type="text"
          className="border-b-2 border-blue-500"
          placeholder="194.56.78.45"
        /> */}

        {/* <label htmlFor="">MAC Address : </label>
        <input
          name="mac"
          value={formData.mac}
          onChange={handleChange}
          type="text"
          className="border-b-2 border-blue-500"
          placeholder="194.56.78.45"
        /> */}

        <label htmlFor="">Domain Name :</label>
        <input
          type="text"
          name="dns"
          value={formData.dns}
          onChange={handleChange}
          className="border-b-2 border-blue-500"
          placeholder="chatgpt.com"
        />

        {/* <label htmlFor="">Type of Restriction :</label>
        <select
          name="restrictionType"
          value={formData.restrictionType}
          onChange={handleChange}
          id=""
        >
          <option value="restricted">Restricted</option>
          <option value="allow">Allow</option>
        </select> */}
        <div></div>
        <button
          className="bg-blue-500 text-white py-2 rounded-lg mt-10"
          type="submit"
        >
          Add Button
        </button>
      </form>
    </div>
  );
};

export default AddBlackListPopupWindow;
