from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import re
import time
import threading
import functools
import requests

app = Flask(__name__)
CORS(app)

# -----------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------
BLACKLIST_FILE = "blacklist.json"
CONFIG_FILE    = "config.json"
MAC_FILE = 'mac_addresses.json'
collecting = True

# -----------------------------------------------------------------------
# State
# -----------------------------------------------------------------------
lock             = threading.Lock()
agent_data       = {}   # mac -> latest payload
_blacklist_cache = None


# -----------------------------------------------------------------------
# File I/O
# -----------------------------------------------------------------------

def load_json(file_path, default):
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def save_json(file_path, data):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

def load_blacklist():
    global _blacklist_cache
    if _blacklist_cache is None:
        _blacklist_cache = load_json(BLACKLIST_FILE, {"domains": []})
    return _blacklist_cache

def save_blacklist(bl):
    global _blacklist_cache
    _blacklist_cache = bl
    save_json(BLACKLIST_FILE, bl)

def load_config():
    return load_json(CONFIG_FILE, {"total_usage_limit": 100 * 1024 * 1024})

def save_config(cfg):
    save_json(CONFIG_FILE, cfg)

config = load_config()
mac_addresses = load_json(MAC_FILE, [])

# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _normalize_mac(mac):
    return mac.lower().replace("-", ":")

def _normalize_domain(domain):
    if not domain:
        return None
    return domain.lower().strip(".")

def _get_2label(domain):
    if not domain:
        return None
    parts = domain.lower().strip(".").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else domain.lower()

def _is_subdomain(domain, parent):
    if not domain or not parent:
        return False
    return domain == parent or domain.endswith("." + parent)

def _check_blacklist_dns(dns_list, bl_domains):
    """Return set of blacklisted domains found in agent dns list."""
    blocked = set()
    for domain in dns_list:
        if any(_is_subdomain(domain, bl) for bl in bl_domains):
            blocked.add(domain)
    return blocked

@functools.lru_cache(maxsize=512)
def _get_mac_vendor(mac):
    try:
        r = requests.get(
            f"https://api.macvendors.com/{mac.upper().replace(':', '-')}",
            timeout=5
        )
        if r.status_code == 200:
            return r.text.strip()
    except Exception:
        pass
    return "Unknown"

# -----------------------------------------------------------------------
# Agent ingestion
# -----------------------------------------------------------------------

def _ingest(raw):
    mac = _normalize_mac(raw.get("mac", ""))
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", mac):
        return None

    # Normalize incoming dns to 2-label unique set
    IGNORE_SUFFIXES = (".local", ".arpa", ".internal")

    incoming_dns = set()
    for domain in raw.get("dns", []):
        d2 = _get_2label(domain)
        if d2 and not any(d2.endswith(s) for s in IGNORE_SUFFIXES):
            incoming_dns.add(d2)

    with lock:
        # Accumulate dns across intervals
        existing_dns = set(agent_data[mac]["dns"]) if mac in agent_data else set()
        merged_dns   = existing_dns | incoming_dns

        agent_data[mac] = {
            "hostname":  raw.get("name",     "Unknown"),
            "username":  raw.get("username", "Unknown"),
            "ip":        raw.get("ip",       "Unknown"),
            "mac":       mac,
            "os":        raw.get("os",       "Unknown"),
            "timestamp": raw.get("timestamp", time.time()),
            "state":     raw.get("state",    "sending"),
            "usage": {
                "upload":   raw.get("usage",       {}).get("upload",   0),
                "download": raw.get("usage",       {}).get("download", 0),
            },
            "total_usage": {
                "upload":   raw.get("total_usage", {}).get("upload",   0),
                "download": raw.get("total_usage", {}).get("download", 0),
            },
            "process": raw.get("process", []),
            "dns":     list(merged_dns),
        }
    return mac

# -----------------------------------------------------------------------
# Agent receiver
# -----------------------------------------------------------------------

@app.route("/add_mac", methods=["POST"])
def add_mac():
    new_mac = request.json.get("mac", "").lower()
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", new_mac):
        return jsonify({"error": "Invalid MAC format"}), 400
    if new_mac not in mac_addresses:
        mac_addresses.append(new_mac)
        save_json(MAC_FILE, mac_addresses)
        return jsonify({"message": f"MAC {new_mac} added", "macs": mac_addresses})
    return jsonify({"message": f"MAC {new_mac} exists", "macs": mac_addresses})

@app.route("/delete_mac", methods=["POST"])
def delete_mac():
    mac = request.json.get("mac", "").lower()
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", mac):
        return jsonify({"error": "Invalid MAC format"}), 400
    if mac in mac_addresses:
        mac_addresses.remove(mac)
        save_json(MAC_FILE, mac_addresses)
        return jsonify({"message": f"MAC {mac} deleted", "macs": mac_addresses})
    return jsonify({"error": f"MAC {mac} not found"}), 404

@app.route("/macs", methods=["GET"])
def list_macs():
    return jsonify({"monitored_macs": mac_addresses})

@app.route("/control", methods=["POST"])
def control():
    global collecting
    collecting = not collecting
    print(f"[control] {'COLLECTING' if collecting else 'STOPPED'}")

    if not collecting:
        # Flush all agent data when stopped
        with lock:
            agent_data.clear()
        print("[control] Agent data cleared")

    return jsonify({"collecting": collecting})

@app.route("/collecting", methods=["GET"])
def get_collecting():
    return jsonify({"collecting": collecting})

@app.route("/usage", methods=["POST"])
def agent_usage():
    raw = request.get_json(silent=True)
    if not raw:
        return jsonify({"error": "No JSON body"}), 400

    mac = _normalize_mac(raw.get("mac", ""))
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", mac):
        return jsonify({"error": "Missing or invalid mac"}), 400

    if collecting:
        # Only ingest when collecting
        mac = _ingest(raw)
        d = agent_data[mac]
        print(f"[{d['os']}] {d['username']}@{d['hostname']} ({d['ip']})  "
              f"↑{d['usage']['upload']:.0f} B/s  "
              f"↓{d['usage']['download']:.0f} B/s  "
              f"procs={len(d['process'])}  dns={len(d['dns'])}")
    else:
        print(f"[stopped] Ignored data from {mac}")

    return jsonify({"status": "ok", "collecting": collecting})

# -----------------------------------------------------------------------
# Data endpoints
# -----------------------------------------------------------------------

@app.route("/data", methods=["GET"])
def get_all():
    """All agents keyed by MAC."""
    with lock:
        return jsonify(agent_data)

@app.route("/data/<mac_address>", methods=["GET"])
def get_one(mac_address):
    """Full detail for a single agent."""
    mac = _normalize_mac(mac_address)
    with lock:
        if mac not in agent_data:
            return jsonify({"error": "Agent not found"}), 404
        d = dict(agent_data[mac])

    vendor = _get_mac_vendor(mac)
    return jsonify({**d, "vendor": vendor})

# -----------------------------------------------------------------------
# Active status
# -----------------------------------------------------------------------

@app.route("/active_status", methods=["GET"])
def active_status():
    now = time.time()
    with lock:
        result = {}

        # MACs from file — always included even if agent not connected
        for mac in mac_addresses:
            if mac in agent_data:
                d = agent_data[mac]
                result[mac] = {
                    "is_active": (now - d["timestamp"]) <= 10,
                    "hostname":  d["hostname"],
                    "username":  d["username"],
                    "ip":        d["ip"],
                }
            else:
                # Known MAC but no agent connected
                result[mac] = {
                    "is_active": False,
                    "hostname":  "Unknown",
                    "username":  "Unknown",
                    "ip":        "Unknown",
                }

        # MACs from agents not in file — include them too
        for mac, d in agent_data.items():
            if mac not in result:
                result[mac] = {
                    "is_active": (now - d["timestamp"]) <= 10,
                    "hostname":  d["hostname"],
                    "username":  d["username"],
                    "ip":        d["ip"],
                }

    return jsonify(result)

# -----------------------------------------------------------------------
# Blacklist
# -----------------------------------------------------------------------

@app.route("/blacklist/domains", methods=["GET"])
def get_blacklist_domains():
    return jsonify({"domains": load_blacklist()["domains"]})

@app.route("/blacklist/domain", methods=["POST"])
def add_blacklist_domain():
    data      = request.get_json()
    incoming  = [_normalize_domain(d) for d in data.get("domains", []) if d]
    blacklist = load_blacklist()
    existing  = set(blacklist["domains"])
    added     = [d for d in incoming if d and d not in existing]
    blacklist["domains"] += added
    save_blacklist(blacklist)
    return jsonify({"message": f"Added {len(added)} domain(s)", "blacklist": blacklist})

@app.route("/blacklist/domain/delete", methods=["POST"])
def delete_blacklist_domain():
    domain = _normalize_domain(request.get_json().get("domain", ""))
    if not domain:
        return jsonify({"error": "Domain not provided"}), 400
    blacklist = load_blacklist()
    if domain in blacklist["domains"]:
        blacklist["domains"].remove(domain)
        save_blacklist(blacklist)
        return jsonify({"message": f"'{domain}' removed", "blacklist": blacklist})
    return jsonify({"error": f"'{domain}' not found"}), 404

@app.route("/check_blacklist", methods=["GET"])
def check_blacklist():
    bl_domains = load_blacklist()["domains"]
    results    = []
    with lock:
        for mac, d in agent_data.items():
            blocked = _check_blacklist_dns(d["dns"], bl_domains)
            results.append({
                "mac":                mac,
                "hostname":           d["hostname"],
                "username":           d["username"],
                "accessed_blacklist": bool(blocked),
                "blocked_domains":    list(blocked),
            })
    return jsonify(results)

# -----------------------------------------------------------------------
# Usage limit
# -----------------------------------------------------------------------

@app.route("/set_limit", methods=["POST"])
def set_limit():
    mb = request.get_json().get("mb")
    if not isinstance(mb, (int, float)) or mb <= 0:
        return jsonify({"error": "Invalid value"}), 400
    config["total_usage_limit"] = int(mb * 1024 * 1024)
    save_config(config)
    return jsonify({"message": "Limit updated", "limit_MB": mb})

@app.route("/check_limit", methods=["GET"])
def check_limit():
    limit    = config["total_usage_limit"]
    limit_mb = round(limit / (1024 * 1024), 2)
    results  = []
    with lock:
        for mac, d in agent_data.items():
            total = d["total_usage"]["upload"] + d["total_usage"]["download"]
            results.append({
                "mac":      mac,
                "hostname": d["hostname"],
                "username": d["username"],
                "exceeded": total > limit,
                "total_MB": round(total / (1024 * 1024), 2),
                "limit_MB": limit_mb,
            })
    return jsonify(results)

# -----------------------------------------------------------------------
# Alerts
# -----------------------------------------------------------------------

@app.route("/alerts", methods=["GET"])
def get_alerts():
    alerts     = []
    now        = time.time()
    INACTIVE   = 10
    limit      = config["total_usage_limit"]
    bl_domains = load_blacklist()["domains"]

    with lock:
        # ── Alerts for connected agents ────────────────────────────────────
        for mac, d in agent_data.items():
            hostname = d["hostname"]
            username = d["username"]
            total    = d["total_usage"]["upload"] + d["total_usage"]["download"]

            # 1. Inactive
            if now - d["timestamp"] > INACTIVE:
                alerts.append({
                    "mac":          mac,
                    "hostname":     hostname,
                    "username":     username,
                    "type":         "inactive",
                    "severity":     "low",
                    "message":      "Agent not reporting",
                    "seconds_idle": int(now - d["timestamp"]),
                })

            # 2. Usage limit exceeded
            if total > limit:
                alerts.append({
                    "mac":            mac,
                    "hostname":       hostname,
                    "username":       username,
                    "type":           "high_usage",
                    "severity":       "medium",
                    "total_usage_MB": round(total / (1024 * 1024), 2),
                    "limit_MB":       round(limit / (1024 * 1024), 2),
                    "message":        "Data usage limit exceeded",
                })

            # 3. Blacklist access
            for site in _check_blacklist_dns(d["dns"], bl_domains):
                alerts.append({
                    "mac":      mac,
                    "hostname": hostname,
                    "username": username,
                    "type":     "blacklist",
                    "severity": "high",
                    "site":     site,
                    "message":  f"{site} accessed",
                })

        # ── Inactive alert for MACs in file but no agent connected ─────────
        for mac in mac_addresses:
            if mac not in agent_data:
                alerts.append({
                    "mac":          mac,
                    "hostname":     "Unknown",
                    "username":     "Unknown",
                    "type":         "inactive",
                    "severity":     "low",
                    "message":      "Agent not connected",
                    "seconds_idle": -1,
                })

    return jsonify({"total_alerts": len(alerts), "alerts": alerts})

# -----------------------------------------------------------------------
# Status
# -----------------------------------------------------------------------

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "agents":     len(agent_data),
        "collecting": collecting,
        "limit_MB":   round(config["total_usage_limit"] / (1024 * 1024), 2),
    })

# -----------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)