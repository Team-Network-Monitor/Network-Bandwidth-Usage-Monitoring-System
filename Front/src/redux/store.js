import { configureStore } from "@reduxjs/toolkit";
import blackListReducer from "./blackListSlice";
import pcsReducer from "./pcsSlice";

const store = configureStore({
  reducer: {
    blacklist: blackListReducer,
    pcs: pcsReducer,
  },
});

export default store;
