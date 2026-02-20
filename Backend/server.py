from flask import Flask, jsonify, request
import socket
import dns.resolver
import json
import threading
import time
import re
import requests
import datetime

from scapy.all import sniff, Ether, IP, UDP, TCP
from scapy.layers.http import HTTPRequest
from scapy.all import DNS, DNSRR,DNSQR
from collections import defaultdict
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -------------------------------
# Global variables
# -------------------------------
running = False
capturing_flag = True
sniffing_thread = None
lock = threading.Lock()
monitoring_started = False

active_macs = {}
mac_to_ip = {}
domain_ips = {}

MAC_FILE = 'mac_addresses.json'
BLACKLIST_FILE = 'blacklist.json'
DOMAIN_IP_FILE = 'domain_ips.json'
CONFIG_FILE = "config.json"


# Structure: mac_traffic[mac][upload/download][2label_domain] = {ips, total_bytes, protocols}
mac_traffic = defaultdict(lambda: {
    "upload": defaultdict(lambda: {"ips": [], "total_bytes": 0, "protocols": []}),
    "download": defaultdict(lambda: {"ips": [], "total_bytes": 0, "protocols": []})
})

mac_stats = defaultdict(lambda: {
    "upload_bytes": 0,
    "download_bytes": 0,
    "last_upload": 0,
    "last_download": 0,
    "upload_speed": 0,
    "download_speed": 0
})

# -------------------------------
# Helper functions
# -------------------------------

def get_2label_domain(domain):
    """Return last two labels of a domain, e.g., sub.example.com -> example.com"""
    if not domain:
        return None
    parts = domain.lower().strip('.').split('.')
    return ".".join(parts[-2:]) if len(parts) >= 2 else domain.lower()

def normalize_domain(domain):
    if not domain:
        return None
    return domain.lower().strip('.')

def is_subdomain(domain, parent_domain):
    if not domain or not parent_domain:
        return False
    return domain == parent_domain or domain.endswith("." + parent_domain)

def get_mac_vendor(mac):
    """Return vendor name for a MAC address using macvendors API"""
    mac = mac.upper().replace(":", "-")
    url = f"https://api.macvendors.com/{mac}"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.text
    except:
        return "Unknown"
    return "Unknown"

def get_hostname(ip):
    """Return hostname for a given IP (reverse DNS)"""
    try:
        return socket.gethostbyaddr(ip)[0]
    except socket.herror:
        return "Unknown"

def get_accessed_site(pkt):
    # HTTP host
    if pkt.haslayer(HTTPRequest):
        return pkt[HTTPRequest].Host.decode(errors="ignore")

    # DNS query
    if pkt.haslayer(DNSQR):
        return pkt[DNSQR].qname.decode(errors="ignore").rstrip(".")

    return None

# -------------------------------
# File I/O
# -------------------------------
def load_json(file_path, default):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def save_json(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

def load_config():
    return load_json(CONFIG_FILE, {
        "total_usage_limit": 1 * 1024 * 1024   # default 500MB
    })

def save_config(cfg):
    save_json(CONFIG_FILE, cfg)


# MACs
mac_addresses = load_json(MAC_FILE, [])
config = load_config()

# Blacklist
def load_blacklist():
    return load_json(BLACKLIST_FILE, {"domains": [], "ips": []})

def save_blacklist(blacklist):
    save_json(BLACKLIST_FILE, blacklist)

# Domain IPs
def load_domain_ips():
    global domain_ips
    domain_ips = load_json(DOMAIN_IP_FILE, {})

def save_domain_ips():
    save_json(DOMAIN_IP_FILE, domain_ips)

# -------------------------------
# Packet processing
# -------------------------------
def process_packet(packet):
    global mac_traffic, active_macs, domain_ips, mac_to_ip, mac_stats

    if not packet.haslayer(Ether):
        return

    src_mac = packet[Ether].src.lower()
    dst_mac = packet[Ether].dst.lower()
    size = len(packet)
    site = get_accessed_site(packet)

    current_time = time.time()
    for mac in [src_mac, dst_mac]:
        if mac in mac_addresses:
            active_macs[mac] = current_time

    src_ip, dst_ip = 'Unknown', 'Unknown'
    protocol = 'Unknown'

    # DNS mapping
    if packet.haslayer(DNS):
        dns = packet[DNS]
        if dns.qr == 1 and dns.an:
            for ans in dns.an:
                if ans.type == 1:  # A record
                    domain = ans.rrname.decode(errors='ignore').rstrip('.')
                    ip = ans.rdata
                    if isinstance(ip, bytes):
                        ip = socket.inet_ntoa(ip)
                    with lock:
                        domain_ips[ip] = domain
                        save_domain_ips()

    # IP layer
    if packet.haslayer(IP):
        ip_layer = packet[IP]
        src_ip = ip_layer.src
        dst_ip = ip_layer.dst
        mac_to_ip[src_mac] = src_ip

        # Determine protocol
        if packet.haslayer(TCP):
            tcp = packet[TCP]
            if tcp.dport == 80 or tcp.sport == 80:
                protocol = "HTTP"
            elif tcp.dport == 443 or tcp.sport == 443:
                protocol = "HTTPS"
            else:
                protocol = "TCP"
        elif packet.haslayer(UDP):
            udp = packet[UDP]
            if udp.dport == 53 or udp.sport == 53:
                protocol = "DNS"
            else:
                protocol = "UDP"

    # HTTP Host fallback
    host = None
    if packet.haslayer(HTTPRequest):
        http = packet[HTTPRequest]
        host = http.Host.decode(errors='ignore') if http.Host else None

    # Update mac_traffic + mac_stats
    for mac, direction, target_ip in [(src_mac, "upload", dst_ip), (dst_mac, "download", src_ip)]:
        if mac in mac_addresses:
            domain = domain_ips.get(target_ip) or host
            main_domain = get_2label_domain(domain) if domain else None
            if not main_domain:
                continue

            with lock:
                # Domain-level traffic
                entry = mac_traffic[mac][direction][main_domain]
                if target_ip not in entry["ips"]:
                    entry["ips"].append(target_ip)
                entry["total_bytes"] += size
                if protocol not in entry["protocols"]:
                    entry["protocols"].append(protocol)

                # Speed-level traffic
                stats = mac_stats[mac]
                if direction == "upload":
                    stats["upload_bytes"] += size
                    stats["last_upload"] += size
                else:
                    stats["download_bytes"] += size
                    stats["last_download"] += size


# -------------------------------
# Speed Calculator
# -------------------------------

def speed_calculator():
    while True:
        time.sleep(1)  # calculate every 1 second
        with lock:
            for mac, stats in mac_stats.items():
                stats["upload_speed"] = stats["last_upload"]
                stats["download_speed"] = stats["last_download"]
                stats["last_upload"] = 0
                stats["last_download"] = 0

threading.Thread(target=speed_calculator, daemon=True).start()


# -------------------------------
# Sniffing
# -------------------------------
def start_sniffing(iface="Wi-Fi"):
    global capturing_flag
    print(f"Sniffing started on {iface}")
    while capturing_flag:
        try:
            sniff(prn=process_packet, iface=iface, timeout=1, store=False)
        except Exception as e:
            print(f"Sniffing error: {e}")
            time.sleep(1)

# -------------------------------
# API endpoints
# -------------------------------
@app.route("/set_limit", methods=["POST"])
def set_limit():
    data = request.get_json()
    mb = data.get("mb")

    if not isinstance(mb, (int, float)) or mb <= 0:
        return jsonify({"error": "Invalid value"}), 400

    config["total_usage_limit"] = int(mb * 1024 * 1024)
    save_config(config)

    return jsonify({
        "message": "Limit updated",
        "limit_MB": mb
    })

@app.route("/start", methods=["GET"])
def start_monitoring():
    global running, capturing_flag, sniffing_thread
    global monitoring_started
    monitoring_started = True
    if not running:
        capturing_flag = True
        running = True
        if sniffing_thread is None or not sniffing_thread.is_alive():
            sniffing_thread = threading.Thread(target=start_sniffing, daemon=True)
            sniffing_thread.start()
        return jsonify({"message": "Monitoring started!"})
    return jsonify({"message": "Monitoring is already running!"})

@app.route("/stop", methods=["GET"])
def stop_monitoring():
    global running, capturing_flag, sniffing_thread, mac_traffic, active_macs, mac_to_ip
    if running:
        capturing_flag = False
        running = False
        monitoring_started = False
        if sniffing_thread is not None:
            sniffing_thread.join(timeout=2)
        mac_traffic.clear()
        active_macs.clear()
        mac_to_ip.clear()
        mac_stats.clear()
        return jsonify({"message": "Monitoring stopped successfully!"})
    return jsonify({"message": "Monitoring was not running!"})

@app.route("/data", methods=["GET"])
def get_data():
    with lock:
        result = {}
        for mac in mac_addresses:
            stats = mac_stats[mac]
            result[mac] = {
                "ip": mac_to_ip.get(mac, "Unknown"),
                "total_usage": stats["upload_bytes"] + stats["download_bytes"],
                "upload_speed": stats["upload_speed"],      # bytes/sec
                "download_speed": stats["download_speed"],  # bytes/sec
                "upload": mac_traffic[mac]["upload"],
                "download": mac_traffic[mac]["download"]
            }
        return jsonify(result)


@app.route("/data/<mac_address>", methods=["GET"])
def get_mac_data(mac_address):
    mac_address = mac_address.lower()
    if mac_address in mac_addresses:
        with lock:
            stats = mac_stats[mac_address]
            ip = mac_to_ip.get(mac_address, "Unknown")
            result = {
                "ip": mac_to_ip.get(mac_address, "Unknown"),
                "hostname": get_hostname(ip) if ip != "Unknown" else "Unknown",
                "vendor": get_mac_vendor(mac_address),
                "last_active":  datetime.datetime.fromtimestamp(active_macs.get(mac_address, 0)),
                "total_usage": stats["upload_bytes"] + stats["download_bytes"],
                "upload_speed": stats["upload_speed"],
                "download_speed": stats["download_speed"],
                "upload": mac_traffic[mac_address]["upload"],
                "download": mac_traffic[mac_address]["download"]
            }
            return jsonify(result)
    return jsonify({"error": "MAC address not found"}), 404


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

@app.route("/blacklist/domain", methods=["POST"])
def add_blacklist_domain():
    data = request.get_json()
    domains = [normalize_domain(d) for d in data.get('domains', [])]
    blacklist = load_blacklist()
    new_domains = [d for d in domains if d not in blacklist['domains']]
    blacklist['domains'] += new_domains
    save_blacklist(blacklist)
    return jsonify({"message": f"Added {len(new_domains)} new domains", "blacklist": blacklist})

@app.route("/blacklist/domains", methods=["GET"])
def get_blacklist_domains():
    return jsonify({"domains": load_blacklist()['domains']})

@app.route("/blacklist/domain/delete", methods=["POST"])
def delete_blacklist_domain():
    data = request.get_json()
    domain = normalize_domain(data.get('domain', ''))
    
    if not domain:
        return jsonify({"error": "Domain not provided"}), 400
    
    blacklist = load_blacklist()
    
    if domain in blacklist['domains']:
        blacklist['domains'].remove(domain)
        save_blacklist(blacklist)
        return jsonify({
            "message": f"Domain '{domain}' removed from blacklist",
            "blacklist": blacklist
        })
    else:
        return jsonify({
            "message": f"Domain '{domain}' not found in blacklist",
            "blacklist": blacklist
        }), 404


@app.route("/check_blacklist", methods=["GET"])
def check_blacklist_access():
    blacklist = load_blacklist()
    results = []
    with lock:
        for mac in mac_addresses:
            accessed = False
            for direction in ["upload", "download"]:
                for domain, info in mac_traffic[mac][direction].items():
                    # Check IP blacklist
                    if any(ip in blacklist['ips'] for ip in info["ips"]):
                        accessed = True
                        break
                    # Check domain blacklist
                    if any(is_subdomain(domain, bl) for bl in blacklist['domains']):
                        accessed = True
                        break
                if accessed:
                    break
            results.append({"mac": mac, "accessed_blacklist": accessed})
    return jsonify(results)

@app.route("/check_limit", methods=["GET"])
def check_usage_limit():
    results = []

    with lock:
        for mac in mac_addresses:
            if not monitoring_started:          # 👈 add this guard
                results.append({
                    "mac": mac,
                    "exceeded": False,
                    "total_MB": 0,
                    "limit_MB": round(config["total_usage_limit"] / (1024*1024), 2)
                })
                continue
            stats = mac_stats[mac]
            total_usage = stats["upload_bytes"] + stats["download_bytes"]
            limit = config["total_usage_limit"]

            results.append({
                "mac": mac,
                "exceeded": total_usage > limit,
                "total_MB": round(total_usage / (1024*1024), 2),
                "limit_MB": round(limit / (1024*1024), 2)
            })

    return jsonify(results)



@app.route("/active_status", methods=["GET"])
def get_active_status():
    threshold = 300
    current_time = time.time()
    status = {}
    with lock:
        for mac in mac_addresses:
            last_active = active_macs.get(mac, 0)
            is_active = (current_time - last_active) <= threshold
            status[mac] = {"is_active": is_active}
    return jsonify(status)

@app.route("/alerts", methods=["GET"])
def get_alerts():
    alerts = []
    now = time.time()

    INACTIVE_LIMIT = 300          # 5 min
    BANDWIDTH_LIMIT = 5 * 1024 * 1024   # 5MB/s

    blacklist = load_blacklist()

    with lock:

        # -----------------------
        # Alerts for monitored MACs
        # -----------------------
        for mac in mac_addresses:

            stats = mac_stats[mac]
            last_seen = active_macs.get(mac, 0)

            # 1️⃣ Inactive device

            if monitoring_started and (now - last_seen > INACTIVE_LIMIT):
                alerts.append({
                    "mac": mac,
                    "type": "inactive",
                    "severity": "low",
                    "message": "Device inactive",
                    "seconds_idle": int(now - last_seen)
                })

            # 2️⃣ High bandwidth usage
            total_usage = stats["upload_bytes"] + stats["download_bytes"]
            limit = config["total_usage_limit"]

            if total_usage > limit:
                alerts.append({
                    "mac": mac,
                    "type": "high_usage",
                    "severity": "medium",
                    "total_usage_MB": round(total_usage / (1024*1024), 2),
                    "limit_MB": round(limit / (1024*1024), 2),
                    "message": "Total data usage exceeded limit"
                })


            # 3️⃣ Blacklist access
            blocked_domains = set()

            for direction in ["upload", "download"]:
                for domain, info in mac_traffic[mac][direction].items():

                    # Check IP blacklist
                    if any(ip in blacklist["ips"] for ip in info["ips"]):
                        blocked_domains.add(domain)

                    # Check domain blacklist
                    if any(is_subdomain(domain, bad) for bad in blacklist["domains"]):
                        blocked_domains.add(domain)

            # Create separate alert for each domain
            for blocked_site in blocked_domains:
                alerts.append({
                    "mac": mac,
                    "type": "blacklist",
                    "severity": "high",
                    "site": blocked_site,
                    "message": f"{blocked_site} accessed"
                })



        # -----------------------
        # Unknown device detection
        # -----------------------
        for mac in active_macs:
            if mac not in mac_addresses:
                alerts.append({
                    "mac": mac,
                    "type": "unknown_device",
                    "severity": "critical",
                    "message": "Unknown device detected on network"
                })

    return jsonify({
        "total_alerts": len(alerts),
        "alerts": alerts
    })


# -------------------------------
# Run
# -------------------------------
if __name__ == "__main__":
    load_domain_ips()
    app.run(debug=True)
