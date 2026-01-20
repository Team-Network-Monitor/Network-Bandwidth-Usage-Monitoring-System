const BASE_URL = "http://127.0.0.1:5000";  // Set your backend URL

function startCapture() {
    fetch(`${BASE_URL}/start_capture`)
        .then(response => response.json())
        .then(data => alert(data.message))
        .catch(error => console.error('Error:', error));
}

function stopCapture() {
    fetch(`${BASE_URL}/stop_capture`)
        .then(response => response.json())
        .then(data => alert(data.message))
        .catch(error => console.error('Error:', error));
}

function refreshData() {
    fetch(`${BASE_URL}/get_data`)
        .then(response => response.json())
        .then(data => {
            updateDataUsageTable(data.data_usage);
            updateCapturedPacketsTable(data.captured_packets);
        })
        .catch(error => console.error('Error:', error));
}

function filterData() {
    let filterIp = document.getElementById("filterIp").value;
    fetch(`${BASE_URL}/get_data`)
        .then(response => response.json())
        .then(data => {
            let filteredPackets = data.captured_packets.filter(packet => 
                packet["Source IP"] === filterIp || packet["Destination IP"] === filterIp
            );
            updateCapturedPacketsTable(filteredPackets);
        })
        .catch(error => console.error('Error:', error));
}
