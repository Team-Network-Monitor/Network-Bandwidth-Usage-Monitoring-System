document.getElementById("start-btn").addEventListener("click", () => {
    fetch("/start")
        .then(response => response.json())
        .then(data => alert(data.message));
});

document.getElementById("refresh-btn").addEventListener("click", () => {
    fetch("/data")
        .then(response => response.json())
        .then(data => {
            console.log(data);
            updateTables(data);
        });
});

// Domain form submission
document.getElementById("domain-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const domain = document.getElementById("domain-input").value;

    fetch("/save_domain", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ domain })
    })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(error => alert("Error saving domain"));
});

function updateTables(data) {
    const macTablesContainer = document.getElementById("mac-tables");
    macTablesContainer.innerHTML = ""; // Clear existing tables

    let i =  -1;
    // Loop through each MAC address group in the data
    for (let mac in data) {
        i++;

        const p = document.createElement("p");
        p.textContent = 'Mac Address: ' + Object.keys(data)[i];
        macTablesContainer.appendChild(p);

        // Create a table for each MAC address group
        const table = document.createElement("table");
        table.classList.add("data-table");

        // Add table header
        const tableHeader = `
            <thead>
                <tr>
                    <th>IP Address</th>
                    <th>Protocol</th>
                    <th>Total Size (MB)</th>
                </tr>
            </thead>
        `;
        table.innerHTML = tableHeader;

        // Create table body and sort IPs by total size (bytes)
        const tableBody = document.createElement("tbody");

        // Sort the IP data by total size (in descending order)
        const sortedIps = Object.keys(data[mac]).sort((a, b) => data[mac][b].bytes - data[mac][a].bytes);

        // Loop through each IP in the sorted order
        sortedIps.forEach(ip => {
            const ipData = data[mac][ip];
            const totalSizeInMB = (ipData.bytes / (1024 * 1024)).toFixed(2); // Convert bytes to MB

            // Create a new row for each IP
            const row = `
                <tr>
                    <td>${ip}</td>
                    <td>${ipData.protocol}</td>
                    <td>${totalSizeInMB} MB</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        table.appendChild(tableBody);
        macTablesContainer.appendChild(table);
    }
}
