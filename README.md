# Network Bandwidth Usage Monitoring System

> **Real-time · Centralised · Cross-Platform**
>
> Built with Python · Flask · React · Scapy

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Flask](https://img.shields.io/badge/Flask-latest-green)
![React](https://img.shields.io/badge/React-19-red)
![Licence](https://img.shields.io/badge/Licence-MIT-yellow)

---

## Table of Contents

1. [Project Description](#1-project-description)
2. [System Architecture & Design](#2-system-architecture--design)
3. [Technologies Used](#3-technologies-used)
4. [Installation Instructions](#4-installation-instructions)
5. [Usage Instructions](#5-usage-instructions)
6. [Dataset](#6-dataset)
7. [Project Structure](#7-project-structure)
8. [Screenshots & Demo](#8-screenshots--demo)
9. [Contributors](#9-contributors)
10. [Contact Information](#10-contact-information)
11. [Licence](#11-licence)

---

## 1. Project Description

### Overview

This project is an evolution and extension of the **"Network Monitoring via Switch Port Mirroring"** system developed by **Group-05**. While the original system focused on capturing aggregate lab traffic through hardware-level port mirroring on Cisco switches, this version extends the architecture into a comprehensive **Network Bandwidth Usage Monitoring System** that provides granular, process-specific insights and cross-platform control.

### Evolution from Previous Work

We have built upon the foundational work of our seniors, who utilized:
* **Hardware-Level Capture:** Using a **Cisco Catalyst 2960 Plus series switch**.
* **SPAN Protocol:** Implementing **Switched Port Analyzer (SPAN)** to mirror traffic from lab PCs to a central monitoring station.
* **Core Objective:** Visualizing lab network activity and identifying basic traffic flows.

**Our extension** shifts from a purely hardware-dependent model to a **hybrid Agent-Based model**, allowing for:
* **Process Identification:** Mapping bandwidth consumption to specific local applications (e.g., Chrome, Discord), which is not possible via switch mirroring alone.
* **Cross-Platform Support:** Native agents for both Windows and Linux.
* **Active Policy Enforcement:** Real-time domain blacklisting and data-cap alerts managed from a centralized dashboard.

### Problem Statement

Managing network bandwidth across multiple devices in a computer lab or corporate environment is challenging without dedicated, expensive infrastructure. Administrators often struggle to identify which devices or applications are actively consuming excessive bandwidth. Furthermore, enforcing network policies like data usage limits or domain blacklisting requires a centralized perspective that is difficult to achieve on mixed-OS environments.

### Objectives

- **Real-Time Visibility:** Provide live upload/download speeds per device.
- **Process Tracking:** Identify the top 10 local processes exceeding allocated bandwidth.
- **Domain Control:** Monitor DNS requests and enforce blacklists to manage access to restricted websites.
- **Centralized Management:** Offer an intuitive React-based dashboard to visualize the lab structure and simplify administration.

### Target Users

- **Network Administrators** — manage bandwidth allocation and enforce policies across a local network.
- **IT Support Teams** — quickly identify the root cause of network congestion or unauthorized access.
- **Computer Lab Managers (e.g., DCS Lab)** — monitor student workstations and ensure fair network usage.

### System Overview

The system operates using a decoupled Client-Server model. A **Master Server (Backend)** coordinates the network data. It receives continuous telemetry from all connected agents, processes this data against global limits and domain blacklists, and serves the current state to the administrative dashboard via a REST API.

**Client Agents** are lightweight Python scripts deployed on Target Windows or Linux computers. They run in the background with administrative privileges, using packet sniffing (`scapy`) to monitor raw traffic and calculate bandwidth. They map network connections to active processes (`psutil`) and report this packaged information back to the Master Server every 5 seconds.

---

## 2. System Architecture & Design

### Network Topology

The system follows a pure Client-Server architecture bridging multiple client platforms to a single centralized hub.

```text
+-------------------+       +-------------------+       +-------------------+
| Windows Agent     |       |   Master Server   |       |   Web Dashboard   |
| (Python + Scapy)  | ----> |   (Flask API)     | <---- |   (React + Redux) |
+-------------------+       +-------------------+       +-------------------+
                                      ^
+-------------------+                 |
| Linux Agent       |                 |
| (Python + Scapy)  | ----------------+
+-------------------+
```

### Core Components

#### Master Server (`Backend/`)
| File | Responsibility |
|------|----------------|
| `server.py` | Flask REST API: Agent data ingestion, MAC address tracking, limits/blacklist enforcement, alert generation |
| `blacklist.json` | Persistent storage for blacklisted domains |
| `config.json` | Persistent storage for global data usage limits |
| `mac_addresses.json` | Registered Target Client MAC addresses storage |

#### Client Agents (`WindowsAgent/` & `LinuxAgent/`)
| File | Responsibility |
|------|----------------|
| `agent.py` | Core sniffer script: packet capture (`scapy`), system metrics (`psutil`), DNS request tracking, process mapping, data formatting, and transmission to Master Server |

#### Web Dashboard (`Front/`)
| Component | Responsibility |
|-----------|----------------|
| React + Redux | Manages global application state, fetching live data and alerts from the Server |
| Recharts | Provides visual bandwidth metrics and upload/download charting |
| Admin Panels | Interfaces to view connected nodes, manage domain blacklists, set data usage caps, and review triggered alerts |

### Data Flow

```text
 Client PC              Agent                                Master Server                 Dashboard
    │                     │                                        │                           │
  1 ├── User browses   ───► Sniffs packets / DNS                   │                           │
    │   watches video     │                                        │                           │
    │                     │                                        │                           │
  2 │                     │ Maps ports to PIDs (psutil)            │                           │
    │                     │ Calculates bps                         │                           │
    │                     │                                        │                           │
  3 │                     ├─ POST /usage (Every 5s) ───────────────► Ingest data               │
    │                     │  {ip, mac, bandwidth, dns, procs}      │ Validate against limits   │
    │                     │                                        │ Check domain blacklist    │
    │                     │                                        │ Generate alerts if needed │
    │                     │                                        │                           │
  4 │                     │                                        ├── GET /data ──────────────► Render charts &
    │                     │                                        ├── GET /alerts ────────────► lists for Admin
```

---

## 3. Technologies Used

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | Python | 3.8+ | Backend Server API and Client Agent scripts |
| HTTP Framework | Flask | Latest | REST API for Master Server |
| Frontend Framework | React | 19 | Web Dashboard UI |
| State Management | Redux Toolkit | Latest | Frontend state management |
| Styling | Tailwind CSS | Latest | Dashboard styling and layout |
| Packet Sniffing | Scapy | Latest | Raw network packet capture on Agents |
| Process Monitoring| Psutil | Latest | Process mapping and network interface metrics |
| HTTP Client | Requests/Axios | Latest | Internal network calls (Agents -> Server -> Dashboard) |
| Dependencies | Npcap | Latest | Required for Windows packet capturing |
| **Legacy Hardware** | **Cisco Catalyst 2960 Plus** | **Legacy** | **Original traffic mirroring source** |
| **Legacy Protocol** | **SPAN** | **Legacy** | **Mirroring traffic for network-wide observation** |

---

## 4. Installation Instructions

### Requirements

- Python 3.8 or higher
- Node.js and npm (for the Dashboard)
- Npcap (Windows Clients Only)
- Administrator/Root privileges on client machines

### 1. Backend Server Setup
Ensure Python 3.8+ is installed on the master machine.
```bash
cd Backend
# Create and activate a virtual environment
python -m venv venv
# Windows: venv\Scripts\activate | Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python server.py
# The server will run on http://0.0.0.0:5000
```

### 2. Frontend Dashboard Setup
Ensure Node.js and npm are installed.
```bash
cd Front

# Install dependencies
npm install

# Start the dashboard
npm start
# The dashboard will open at http://localhost:3000
```

### 3. Agent Setup (Windows & Linux)
Agents must be deployed on the client machines you wish to monitor. They require Administrator/Root privileges to capture packets.

#### Windows Agent:
1. Install [Npcap](https://npcap.com) (Check "WinPcap API-compatible Mode").
2. Open Command Prompt as **Administrator**.
3. Install dependencies: `pip install scapy psutil`.
4. Run the agent: `cd WindowsAgent && python agent.py`.

#### Linux Agent:
1. Install dependencies: `sudo apt install python3 python3-pip && sudo pip3 install scapy psutil`.
2. Run the agent with sudo: `cd LinuxAgent && sudo python3 agent.py`.

*Note: On first run, the agent will prompt for the Master Server's IP address and Port (default `5000`).*

---

## 5. Usage Instructions

### Step 1 — Start the Infrastructure
Start the Backend Flask server and the Frontend React dashboard.
```bash
# Terminal 1 — Backend
python Backend/server.py

# Terminal 2 — Frontend
cd Front && npm start
```

### Step 2 — Deploy Agents
Run the `agent.py` scripts on the client machines you wish to monitor, pointing them to the Backend server's IP address.

### Step 3 — Monitor Dashboard
Access `http://localhost:3000`. You will see all connected agents.
- **Real-time Monitoring:** View live Upload/Download speeds.
- **Data Limits:** Set a global data usage limit (in MB). Agents exceeding this limit will trigger an alert.
- **Blacklist:** Add domains to the blacklist. If an agent accesses a blacklisted domain, a high-severity alert is generated.
- **Alerts:** View the alerts panel for inactive agents, limit breaches, or blacklist violations.

---

## 6. Dataset

This project does not use a fixed or pre-existing dataset. The system continuously operates on **live, real-time network traffic and packet streams** generated by the active applications on the target computers. 

---

## 7. Project Structure

```text
Network-Bandwidth-Usage-Monitoring-System/
│
├── Backend/                 # Flask REST API Server
│   ├── server.py            #   Main server logic (data ingestion, rules)
│   ├── requirements.txt     #   Python dependencies
│   ├── config.json          #   Global config (usage limits)
│   ├── blacklist.json       #   Restricted domains
│   ├── mac_addresses.json   #   Registered agent hardware addresses
│   └── ...
│
├── Front/                   # React Web Dashboard
│   ├── src/                 #   React components and Redux slices
│   ├── public/              #   Static assets
│   ├── package.json         #   Node dependencies
│   └── tailwind.config.js   #   Tailwind CSS configuration
│
├── LinuxAgent/              # Client Agent for Linux
│   ├── agent.py             #   Python sniffing script
│   └── README.md            #   Linux-specific setup guide
│
├── WindowsAgent/            # Client Agent for Windows
│   ├── agent.py             #   Python sniffing script
│   └── readme.md            #   Windows-specific setup guide
│
└── README.md                # This file
```

---

## 8. Screenshots & Demo

> 📹 **Demo Video:** `[Insert link — YouTube / Google Drive / institution host]`

| Screenshot | Description |
|-----------|-------------|
| Dashboard Overview | Live table of active agents with their current Upload/Download speeds |
| Process Monitoring | Detailed view showing the top 10 bandwidth-consuming background applications (e.g. Chrome, Discord) |
| Alerts Panel | Logs of inactive agents, exceeded data caps, and domain blacklist violations |
| Settings | Configuration view to modify the global data limit and blacklist entries |

*(Add screenshots of your dashboard here by replacing the table contents or linking below)*

- **Dashboard View:** `![Dashboard](path/to/screenshot1.png)`
- **Alerts View:** `![Alerts](path/to/screenshot2.png)`

---

## 9. Contributors

| Name | Registration No. | Role & Contribution |
|------|-----------------|---------------------|
| H.H.A.D.H.M.Hettiarachchi | 2021/CSC/017 | component development, Redux state management |
| Rideesh Kavindu | 2021/CSC/060 | Flask server, agent design, architecture |
| T.P.D. Nimshan Tharamasinghe |  2021/CSC/078 | React dashboard, all UI components |
| G.T. Kaveesha Dilshani | 2021/CSC/101 | Testing |
---

## 10. Contact Information

| Name | Email | Institution |
|------|-------|-------------|
| H.H.A.D.H.M.Hettiarachchi | hettiarachchihiroshan01@gmail.com | University of Jaffna, Department of Computer Science |
| Rideesh Kavindu | kavindurideesh@gmail.com | University of Jaffna, Department of Computer Science |
| T.P.D. Nimshan Tharamasinghe | nimshandilunika@gmail.com | University of Jaffna, Department of Computer Science |
| G.T. Kaveesha Dilshani| kaveedill2000@gmail.com | University of Jaffna, Department of Computer Science |


---

## 11. Licence

**MIT Licence**

Copyright (c) 2026

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
