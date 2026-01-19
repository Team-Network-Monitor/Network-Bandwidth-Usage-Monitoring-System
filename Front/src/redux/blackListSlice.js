import { createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const initialState = {
  blackListeddomains: [],
};

const sendDomainToBackend = async (domain) => {
  try {
    await axios.post("http://127.0.0.1:5000/blacklist/domain", {
      domains: [domain],
    });
  } catch (error) {
    console.error("Failed to send MAC to backend:", error);
  }
};

const deleteBlacklistDomain = async (domain) => {
  // setIsLoading(true);
  try {
    await axios.post(`http://127.0.0.1:5000/blacklist/domain/delete`, {
      domain,
    });
  } catch (err) {
    console.error("Error fetching data", err);
  }
};

const blackListSlice = createSlice({
  name: "blacklist",
  initialState,
  reducers: {
    addToBlackList: (state, action) => {
      sendDomainToBackend(action.payload);

      state.blackListeddomains.push(action.payload);
    },
    setInitialization: (state, action) => {
      state.blackListeddomains = action.payload;
    },
    deleteBlackList: (state, action) => {
      deleteBlacklistDomain(action.payload);
      state.blackListeddomains = state.blackListeddomains.filter(
        (domain) => domain !== action.payload
      );
    },
  },
});

export const { addToBlackList, setInitialization, deleteBlackList } =
  blackListSlice.actions;
export const getBlaclist = (state) => state.blacklist.blackListeddomains;
export default blackListSlice.reducer;
