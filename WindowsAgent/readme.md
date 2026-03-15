# Network Usage Agent — Windows Setup Guide

## Prerequisites

### 1. Python
Download and install Python 3.8+ from https://python.org  
During installation, check **"Add Python to PATH"**

### 2. Npcap
Required for Scapy to capture packets on Windows.  
Download from https://npcap.com and install with default settings.  
Make sure **"WinPcap API-compatible Mode"** is checked during install.

---

## Installation

### Step 1 — Install dependencies
Open Command Prompt as **Administrator** and run:
```
pip install scapy psutil
```

### Step 2 — Download the agent
Save `agent.py` to a folder, e.g.:
```
C:\NetMonAgent\agent.py
```

---

## Running the Agent

> ⚠️ Must be run as **Administrator** — Scapy requires raw socket access.

### Option A — Command Prompt (Admin)
1. Press `Win + S`, search **Command Prompt**
2. Right-click → **Run as administrator**
3. Navigate to the agent folder:
```
cd C:\NetMonAgent
```
4. Run the agent:
```
python agent.py
```

### Option B — Right-click shortcut
1. Right-click `agent.py`
2. Select **Run as administrator**

---

## First Run

When the agent starts you will be prompted:
```
=== Network Usage Agent ===
Master IP   : 192.168.8.1
Master port [5000]:
```

- **Master IP** — IP address of the machine running `app.py` (the server)
- **Master port** — leave blank to use default `5000`

After entering the details you should see:
```
  Host    : DESKTOP-ABC123
  User    : rideesh
  IP      : 192.168.8.131
  MAC     : 8c:15:db:57:1f:b9
  OS      : Windows
  Master  : 192.168.8.1:5000

  Starting...

[20:01:43] ↑1024 B/s  ↓8192 B/s  procs=8  dns=3  | LIVE
```

---

## Console Output

| Symbol | Meaning |
|--------|---------|
| `LIVE` | Server is collecting data |
| `STOPPED` | Server paused — agent will reset and wait |
| `Send failed` | Cannot reach master — check IP and port |

---

## Troubleshooting

**`No module named 'scapy'`**
```
pip install scapy
```

**`sniff() requires admin`** or no packets captured  
→ Make sure you are running as **Administrator**

**`Send failed: Connection refused`**  
→ Check that `app.py` is running on the master machine  
→ Verify the IP and port are correct  
→ Check Windows Firewall — allow port `5000` inbound on the server

**MAC shows as `00:00:00:00:00:00`**  
→ Npcap may not be installed correctly — reinstall from https://npcap.com

**Npcap not found by Scapy**  
→ Uninstall and reinstall Npcap with **"WinPcap API-compatible Mode"** checked

---

## Auto-start on Login (Optional)

To have the agent start automatically:

1. Create a batch file `start_agent.bat`:
```batch
@echo off
cd C:\NetMonAgent
python agent.py
pause
```

2. Press `Win + R`, type `shell:startup`
3. Place a shortcut to `start_agent.bat` in the startup folder
4. Right-click the shortcut → Properties → Advanced → check **Run as administrator**

---

## Firewall Rule (on server machine)

Run on the **server** machine to allow agents to connect:
```
netsh advfirewall firewall add rule name="NetMon Agent" dir=in action=allow protocol=TCP localport=5000
```