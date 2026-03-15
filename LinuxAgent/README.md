# Network Usage Agent — Linux Setup Guide

## Prerequisites

### 1. Python 3.8+
```bash
sudo apt update
sudo apt install python3 python3-pip -y
```

### 2. Dependencies
```bash
sudo pip3 install scapy psutil
```

> On some distros use `pip3 install --break-system-packages scapy psutil`

---

## Installation

Save `agent.py` to a folder:
```bash
mkdir ~/NetMonAgent
cd ~/NetMonAgent
# copy agent.py here
```

---

## Running the Agent

> ⚠️ Must be run with **sudo** — Scapy requires raw socket access.
```bash
sudo python3 agent.py
```

### First Run Prompt
```
=== Network Usage Agent (Linux) ===
Master IP   : 192.168.8.1
Master port [5000]:
```

- **Master IP** — IP of the machine running `app.py`
- **Master port** — press Enter for default `5000`

### Expected Output
```
  Host      : ubuntu-pc
  User      : rideesh
  IP        : 192.168.8.131
  MAC       : 12:22:d2:87:1f:23
  Interface : eth0
  OS        : Linux
  Master    : 192.168.8.1:5000

  Starting...

[20:01:43] ↑1024 B/s  ↓8192 B/s  procs=8  dns=3  | LIVE
```

---

## Console Output

| Symbol | Meaning |
|--------|---------|
| `LIVE` | Server is collecting data |
| `STOPPED` | Server paused — agent resets and waits |
| `Send failed` | Cannot reach master — check IP and port |

---

## Troubleshooting

**`Permission denied` or `Operation not permitted`**
→ Run with `sudo`

**`No module named 'scapy'`**
```bash
sudo pip3 install scapy
```

**`Send failed: Connection refused`**
→ Check `app.py` is running on the master  
→ Verify the IP and port  
→ Check firewall on the server machine:
```bash
sudo ufw allow 5000
```

**Wrong interface detected**
→ Check your interfaces:
```bash
ip addr show
```
→ The agent auto-detects the interface matching your IP. If wrong, set it manually in the script:
```python
_iface = "eth0"   # or wlan0, ens33, etc.
```

**Username shows as `root` instead of your username**
→ This is normal if `SUDO_USER` is not set. The agent reads `SUDO_USER` automatically when using `sudo`.

---

## Auto-start with systemd (Optional)

Create a service file:
```bash
sudo nano /etc/systemd/system/netmon-agent.service
```

Paste:
```ini
[Unit]
Description=NetMon Network Usage Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/rideesh/NetMonAgent
ExecStart=/usr/bin/python3 /home/rideesh/NetMonAgent/agent_linux.py
Restart=on-failure
RestartSec=5
Environment=MASTER_IP=192.168.8.1
Environment=MASTER_PORT=5000

[Install]
WantedBy=multi-user.target
```

> Note: the agent prompts for IP/port interactively, so for systemd you should hardcode them in the script's `main()`:
```python
master_ip   = "192.168.8.1"
master_port = "5000"
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable netmon-agent
sudo systemctl start netmon-agent
```

Check status:
```bash
sudo systemctl status netmon-agent
sudo journalctl -u netmon-agent -f
```

---

## Firewall Rule (on server machine)
```bash
sudo ufw allow 5000/tcp
```

Or if using `firewalld`:
```bash
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload
```