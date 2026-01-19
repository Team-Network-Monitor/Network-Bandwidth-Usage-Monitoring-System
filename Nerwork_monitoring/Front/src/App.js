import { useEffect, useState } from "react";
import "./App.css";
import NetworkDashboard from "./pages/NetworkDashboard";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setInitialization } from "./redux/blackListSlice";

function App() {
  const [error, setError] = useState();
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchBlackList = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/blacklist/domains`
        );
        console.log("************ : ", response.data.domains[0]);
        dispatch(setInitialization(response.data.domains));
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    fetchBlackList();
  }, []);
  return (
    <div className="App">
      {/* <h1 className='text-red-500'>hello</h1> */}
      <NetworkDashboard />
    </div>
  );
}

export default App;
