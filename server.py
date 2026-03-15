from flask import Flask, jsonify, request
import socket
import json
import threading
import time
import re
import requests
import datetime
import functools

from scapy.all import sniff, Ether, IP, UDP, TCP
from scapy.layers.http import HTTPRequest
from scapy.all import DNS, DNSQR
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
domain_ips = {}          # ip -> domain
_blacklist_cache = None  # in-memory cache, invalidated on write

MAC_FILE = 'mac_addresses.json'
BLACKLIST_FILE = 'blacklist.json'
DOMAIN_IP_FILE = 'domain_ips.json'
CONFIG_FILE = "config.json"

# Structure: mac_traffic[mac][upload/download][2label_domain] = {ips, total_bytes, protocols}
mac_traffic = defaultdict(lambda: {
    "upload":   defaultdict(lambda: {"ips": [], "total_bytes": 0, "protocols": []}),
    "download": defaultdict(lambda: {"ips": [], "total_bytes": 0, "protocols": []})
})

mac_stats = defaultdict(lambda: {
    "upload_bytes":    0,
    "download_bytes":  0,
    "last_upload":     0,
    "last_download":   0,
    "upload_speed":    0,
    "download_speed":  0
})

# -------------------------------
# Helper functions
# -------------------------------

def get_2label_domain(domain):
    """Return last two labels of a domain, e.g. sub.example.com -> example.com"""
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

@functools.lru_cache(maxsize=512)
def get_mac_vendor(mac):
    """Return vendor name for a MAC address using macvendors API (cached)."""
    mac_fmt = mac.upper().replace(":", "-")
    try:
        response = requests.get(f"https://api.macvendors.com/{mac_fmt}", timeout=5)
        if response.status_code == 200:
            return response.text
    except Exception:
        pass
    return "Unknown"

@functools.lru_cache(maxsize=512)
def get_hostname(ip):
    """Return hostname for a given IP via reverse DNS (cached)."""
    try:
        return socket.gethostbyaddr(ip)[0]
    except socket.herror:
        return "Unknown"

def get_accessed_site(pkt):
    if pkt.haslayer(HTTPRequest):
        return pkt[HTTPRequest].Host.decode(errors="ignore")
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
    return load_json(CONFIG_FILE, {"total_usage_limit": 1 * 1024 * 1024})

def save_config(cfg):
    save_json(CONFIG_FILE, cfg)

# MACs & config loaded once at startup
mac_addresses = load_json(MAC_FILE, [])
config = load_config()

# Blacklist — kept in memory, written on mutation
def load_blacklist():
    global _blacklist_cache
    if _blacklist_cache is None:
        _blacklist_cache = load_json(BLACKLIST_FILE, {"domains": [], "ips": []})
    return _blacklist_cache

def save_blacklist(blacklist):
    global _blacklist_cache
    _blacklist_cache = blacklist
    save_json(BLACKLIST_FILE, blacklist)

# Domain IPs
def load_domain_ips():
    global domain_ips
    domain_ips = load_json(DOMAIN_IP_FILE, {})

_domain_ips_dirty = False          # batched write flag

def _domain_ips_writer():
    """Background thread: flush domain_ips to disk every 5 s if dirty."""
    global _domain_ips_dirty
    while True:
        time.sleep(5)
        if _domain_ips_dirty:
            with lock:
                data = dict(domain_ips)
                _domain_ips_dirty = False
            save_json(DOMAIN_IP_FILE, data)

threading.Thread(target=_domain_ips_writer, daemon=True).start()

# -------------------------------
# Packet processing
# -------------------------------

# Pre-compile protocol detection sets for O(1) lookup
_HTTP_PORTS  = {80}
_HTTPS_PORTS = {443}
_DNS_PORTS   = {53}

# Application/Port mapping for detecting applications
APP_PORT_MAP = {
    # Web browsers (HTTPS/HTTP)
    80: "Web (HTTP)",
    443: "Web (HTTPS)",
    8443: "Web (HTTPS Alt)",
    8080: "Web (HTTP Proxy)",
    8000: "Web (HTTP Alt)",
    # Messaging & Social
    5222: "XMPP (WhatsApp/Discord)",
    5228: "WhatsApp",
    5230: "WhatsApp",
    3478: "STUN (Zoom/Discord)",
    3479: "Zoom",
    3480: "Zoom",
    # Video streaming
    1935: "RTMP (Streaming)",
    4433: "HLS Streaming",
    8554: "RTSP (Streaming)",
    # Gaming
    3074: "Xbox Live",
    3478: "PlayStation Network",
    5222: "Steam",
    27015: "Steam",
    27017: "Steam",
    # Cloud & Sync
    443: "Cloud Services",
    587: "Email (SMTP)",
    993: "Email (IMAP)",
    995: "Email (POP3)",
    # Development
    3000: "Dev Server (Node)",
    5000: "Flask/Dev Server",
    8000: "Dev Server",
    9000: "PHP-FPM",
    # Database
    3306: "MySQL",
    5432: "PostgreSQL",
    27017: "MongoDB",
    6379: "Redis",
    # File Transfer
    20: "FTP (Data)",
    21: "FTP (Control)",
    22: "SSH/SFTP",
    # VPN & Remote
    1194: "OpenVPN",
    1723: "VPN",
    500: "IPSec VPN",
    # DNS
    53: "DNS",
}

# Domain to Application mapping
APP_DOMAIN_MAP = {
    # Google services
    "google.com": "Chrome/Google",
    "googleusercontent.com": "Chrome/Google",
    "gstatic.com": "Chrome/Google",
    "youtube.com": "YouTube",
    "ytimg.com": "YouTube",
    "googlevideo.com": "YouTube",
    # Microsoft services
    "microsoft.com": "Edge/Windows",
    "windows.net": "Windows Cloud",
    "live.com": "Microsoft 365",
    "office.com": "Microsoft 365",
    "office365.com": "Microsoft 365",
    "sharepoint.com": "SharePoint",
    "onedrive.com": "OneDrive",
    "xbox.com": "Xbox",
    "bing.com": "Bing",
    # Apple services
    "apple.com": "Apple",
    "icloud.com": "iCloud",
    "mzstatic.com": "App Store",
    # Social media
    "facebook.com": "Facebook",
    "instagram.com": "Instagram",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "tiktok.com": "TikTok",
    "snapchat.com": "Snapchat",
    "linkedin.com": "LinkedIn",
    "reddit.com": "Reddit",
    "pinterest.com": "Pinterest",
    # Streaming
    "netflix.com": "Netflix",
    "amazonprimevideo.com": "Prime Video",
    "hulu.com": "Hulu",
    "disneyplus.com": "Disney+",
    "hbomax.com": "HBO Max",
    "spotify.com": "Spotify",
    "twitch.tv": "Twitch",
    "soundcloud.com": "SoundCloud",
    # Communication
    "zoom.us": "Zoom",
    "webex.com": "Webex",
    "slack.com": "Slack",
    "discord.com": "Discord",
    "discord.gg": "Discord",
    "whatsapp.com": "WhatsApp",
    "whatsapp.net": "WhatsApp",
    "telegram.org": "Telegram",
    "messenger.com": "Facebook Messenger",
    # Cloud storage
    "dropbox.com": "Dropbox",
    "box.com": "Box",
    "drive.google.com": "Google Drive",
    "dropboxusercontent.com": "Dropbox",
    # Gaming
    "steampowered.com": "Steam",
    "epicgames.com": "Epic Games",
    "battle.net": "Battle.net",
    "origin.com": "Origin (EA)",
    "ea.com": "EA",
    # VPN & Security
    "nordvpn.com": "NordVPN",
    "expressvpn.com": "ExpressVPN",
    # News & Info
    "cnn.com": "CNN",
    "bbc.com": "BBC",
    "nytimes.com": "NY Times",
    "reuters.com": "Reuters",
    "wikipedia.org": "Wikipedia",
    # Shopping
    "amazon.com": "Amazon",
    "ebay.com": "eBay",
    "walmart.com": "Walmart",
    "alibaba.com": "Alibaba",
    "aliexpress.com": "AliExpress",
    # Education
    "coursera.org": "Coursera",
    "udemy.com": "Udemy",
    "edx.org": "edX",
    "khanacademy.org": "Khan Academy",
    # Other common
    "reddit.com": "Reddit",
    "stackoverflow.com": "Stack Overflow",
    "github.com": "GitHub",
    "gitlab.com": "GitLab",
    "bitbucket.org": "Bitbucket",
    "medium.com": "Medium",
    "quora.com": "Quora",
    "adobe.com": "Adobe",
    "wix.com": "Wix",
    "wordpress.com": "WordPress",
}

def _detect_protocol(packet):
    if packet.haslayer(TCP):
        ports = {packet[TCP].dport, packet[TCP].sport}
        if ports & _HTTP_PORTS:   return "HTTP"
        if ports & _HTTPS_PORTS:  return "HTTPS"
        return "TCP"
    if packet.haslayer(UDP):
        ports = {packet[UDP].dport, packet[UDP].sport}
        if ports & _DNS_PORTS:    return "DNS"
        return "UDP"
    return "Unknown"

def process_packet(packet):
    global _domain_ips_dirty

    if not packet.haslayer(Ether):
        return

    eth  = packet[Ether]
    src_mac = eth.src.lower()
    dst_mac = eth.dst.lower()
    size = len(packet)

    current_time = time.time()
    # Update active_macs only for watched MACs
    mac_set = set(mac_addresses)
    if src_mac in mac_set:
        active_macs[src_mac] = current_time
    if dst_mac in mac_set:
        active_macs[dst_mac] = current_time

    src_ip = dst_ip = "Unknown"
    protocol = "Unknown"

    # DNS A-record mapping (batch under one lock acquisition)
    if packet.haslayer(DNS):
        dns = packet[DNS]
        if dns.qr == 1 and dns.an:
            new_mappings = {}
            for ans in dns.an:
                if ans.type == 1:  # A record
                    domain = ans.rrname.decode(errors='ignore').rstrip('.')
                    ip = ans.rdata
                    if isinstance(ip, bytes):
                        ip = socket.inet_ntoa(ip)
                    new_mappings[ip] = domain
            if new_mappings:
                with lock:
                    domain_ips.update(new_mappings)
                    _domain_ips_dirty = True

    host = None
    if packet.haslayer(IP):
        ip_layer = packet[IP]
        src_ip, dst_ip = ip_layer.src, ip_layer.dst
        mac_to_ip[src_mac] = src_ip
        protocol = _detect_protocol(packet)

    if packet.haslayer(HTTPRequest):
        http = packet[HTTPRequest]
        host = http.Host.decode(errors='ignore') if http.Host else None

    # Only process MACs we care about — avoids lock on every foreign packet
    relevant = []
    if src_mac in mac_set:
        relevant.append((src_mac, "upload", dst_ip))
    if dst_mac in mac_set:
        relevant.append((dst_mac, "download", src_ip))

    if not relevant:
        return

    with lock:
        for mac, direction, target_ip in relevant:
            domain = domain_ips.get(target_ip) or host
            main_domain = get_2label_domain(domain) if domain else None
            if not main_domain:
                continue

            entry = mac_traffic[mac][direction][main_domain]
            if target_ip not in entry["ips"]:
                entry["ips"].append(target_ip)
            entry["total_bytes"] += size
            if protocol not in entry["protocols"]:
                entry["protocols"].append(protocol)

            stats = mac_stats[mac]
            if direction == "upload":
                stats["upload_bytes"]  += size
                stats["last_upload"]   += size
            else:
                stats["download_bytes"] += size
                stats["last_download"]  += size

# -------------------------------
# Speed Calculator
# -------------------------------
def speed_calculator():
    while True:
        time.sleep(1)
        with lock:
            for stats in mac_stats.values():
                stats["upload_speed"]   = stats["last_upload"]
                stats["download_speed"] = stats["last_download"]
                stats["last_upload"]    = 0
                stats["last_download"]  = 0

threading.Thread(target=speed_calculator, daemon=True).start()

# -------------------------------
# Sniffing
# -------------------------------
def start_sniffing(iface="Local Area Connection* 2"):
    global capturing_flag
    print(f"Sniffing started on {iface}")
    while capturing_flag:
        try:
            sniff(prn=process_packet, iface=iface, timeout=1, store=False)
        except Exception as e:
            print(f"Sniffing error: {e}")
            time.sleep(1)

# -------------------------------
# Serialisation helper
# -------------------------------
def _serialise_traffic(traffic_dict):
    """Convert nested defaultdicts to plain dicts for jsonify."""
    return {
        domain: dict(info)
        for domain, info in traffic_dict.items()
    }

# -------------------------------
# Application detection
# -------------------------------
def detect_application(domain, protocols, target_ip=None):
    """Detect application name from domain and protocols."""
    if not domain:
        return "Unknown"
    
    # First check domain mapping
    main_domain = get_2label_domain(domain)
    if main_domain and main_domain in APP_DOMAIN_MAP:
        return APP_DOMAIN_MAP[main_domain]
    
    # Check if any key in APP_DOMAIN_MAP is a suffix of the domain
    for app_domain, app_name in APP_DOMAIN_MAP.items():
        if domain.endswith(app_domain):
            return app_name
    
    # Check protocol-based detection
    if "HTTPS" in protocols or "443" in str(protocols):
        return "Web (HTTPS)"
    if "HTTP" in protocols or "80" in str(protocols):
        return "Web (HTTP)"
    if "DNS" in protocols or "53" in str(protocols):
        return "DNS"
    if "TCP" in protocols:
        return "TCP Traffic"
    if "UDP" in protocols:
        return "UDP Traffic"
    
    return "Unknown"

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
    return jsonify({"message": "Limit updated", "limit_MB": mb})

@app.route("/start", methods=["GET"])
def start_monitoring():
    global running, capturing_flag, sniffing_thread, monitoring_started
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
    global running, capturing_flag, sniffing_thread, monitoring_started
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
                "ip":             mac_to_ip.get(mac, "Unknown"),
                "total_usage":    stats["upload_bytes"] + stats["download_bytes"],
                "upload_speed":   stats["upload_speed"],
                "download_speed": stats["download_speed"],
                "upload":         _serialise_traffic(mac_traffic[mac]["upload"]),
                "download":       _serialise_traffic(mac_traffic[mac]["download"])
            }
    return jsonify(result)

@app.route("/data/<mac_address>", methods=["GET"])
def get_mac_data(mac_address):
    mac_address = mac_address.lower()
    if mac_address not in mac_addresses:
        return jsonify({"error": "MAC address not found"}), 404

    with lock:
        stats  = mac_stats[mac_address]
        ip     = mac_to_ip.get(mac_address, "Unknown")
        upload   = _serialise_traffic(mac_traffic[mac_address]["upload"])
        download = _serialise_traffic(mac_traffic[mac_address]["download"])
        last_ts  = active_macs.get(mac_address, 0)
        total    = stats["upload_bytes"] + stats["download_bytes"]
        up_spd   = stats["upload_speed"]
        dn_spd   = stats["download_speed"]

    # Expensive I/O outside the lock
    result = {
        "ip":             ip,
        "hostname":       get_hostname(ip) if ip != "Unknown" else "Unknown",
        "vendor":         get_mac_vendor(mac_address),
        "last_active":    datetime.datetime.fromtimestamp(last_ts),
        "total_usage":    total,
        "upload_speed":   up_spd,
        "download_speed": dn_spd,
        "upload":         upload,
        "download":       download
    }
    return jsonify(result)

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
    existing = set(blacklist['domains'])
    new_domains = [d for d in domains if d not in existing]
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
        return jsonify({"message": f"Domain '{domain}' removed from blacklist", "blacklist": blacklist})
    return jsonify({"message": f"Domain '{domain}' not found in blacklist", "blacklist": blacklist}), 404

@app.route("/check_blacklist", methods=["GET"])
def check_blacklist_access():
    blacklist = load_blacklist()
    bl_domains = blacklist['domains']
    bl_ips     = set(blacklist['ips'])
    results = []
    with lock:
        for mac in mac_addresses:
            accessed = False
            outer_break = False
            for direction in ("upload", "download"):
                for domain, info in mac_traffic[mac][direction].items():
                    if bl_ips & set(info["ips"]):
                        accessed = True
                    elif any(is_subdomain(domain, bl) for bl in bl_domains):
                        accessed = True
                    if accessed:
                        outer_break = True
                        break
                if outer_break:
                    break
            results.append({"mac": mac, "accessed_blacklist": accessed})
    return jsonify(results)

@app.route("/check_limit", methods=["GET"])
def check_usage_limit():
    limit = config["total_usage_limit"]
    limit_mb = round(limit / (1024 * 1024), 2)
    results = []
    with lock:
        for mac in mac_addresses:
            if not monitoring_started:
                results.append({"mac": mac, "exceeded": False, "total_MB": 0, "limit_MB": limit_mb})
                continue
            stats = mac_stats[mac]
            total = stats["upload_bytes"] + stats["download_bytes"]
            results.append({
                "mac":      mac,
                "exceeded": total > limit,
                "total_MB": round(total / (1024 * 1024), 2),
                "limit_MB": limit_mb
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
            status[mac] = {"is_active": (current_time - last_active) <= threshold}
    return jsonify(status)

@app.route("/applications", methods=["GET"])
def get_applications():
    """Get aggregated application usage across all monitored MACs."""
    app_usage = defaultdict(lambda: {"bytes": 0, "domains": set()})
    
    with lock:
        for mac in mac_addresses:
            for direction in ("upload", "download"):
                for domain, info in mac_traffic[mac][direction].items():
                    app_name = detect_application(domain, info.get("protocols", []))
                    app_usage[app_name]["bytes"] += info.get("total_bytes", 0)
                    app_usage[app_name]["domains"].add(domain)
    
    # Convert to list format
    result = []
    for app_name, data in app_usage.items():
        result.append({
            "app": app_name,
            "bytes": data["bytes"],
            "domains": list(data["domains"])[:5]  # Limit to 5 example domains
        })
    
    # Sort by bytes descending
    result.sort(key=lambda x: x["bytes"], reverse=True)
    
    return jsonify(result[:20])  # Return top 20 apps

@app.route("/alerts", methods=["GET"])
def get_alerts():
    alerts = []
    now = time.time()
    INACTIVE_LIMIT = 300
    limit = config["total_usage_limit"]
    blacklist  = load_blacklist()
    bl_domains = blacklist['domains']
    bl_ips     = set(blacklist['ips'])

    with lock:
        for mac in mac_addresses:
            stats     = mac_stats[mac]
            last_seen = active_macs.get(mac, 0)

            # 1. Inactive device
            if monitoring_started and (now - last_seen > INACTIVE_LIMIT):
                alerts.append({
                    "mac":          mac,
                    "type":         "inactive",
                    "severity":     "low",
                    "message":      "Device inactive",
                    "seconds_idle": int(now - last_seen)
                })

            # 2. High bandwidth / usage limit
            total_usage = stats["upload_bytes"] + stats["download_bytes"]
            if total_usage > limit:
                alerts.append({
                    "mac":            mac,
                    "type":           "high_usage",
                    "severity":       "medium",
                    "total_usage_MB": round(total_usage / (1024 * 1024), 2),
                    "limit_MB":       round(limit / (1024 * 1024), 2),
                    "message":        "Total data usage exceeded limit"
                })

            # 3. Blacklist access
            blocked_domains = set()
            for direction in ("upload", "download"):
                for domain, info in mac_traffic[mac][direction].items():
                    if bl_ips & set(info["ips"]):
                        blocked_domains.add(domain)
                    elif any(is_subdomain(domain, bad) for bad in bl_domains):
                        blocked_domains.add(domain)

            for blocked_site in blocked_domains:
                alerts.append({
                    "mac":      mac,
                    "type":     "blacklist",
                    "severity": "high",
                    "site":     blocked_site,
                    "message":  f"{blocked_site} accessed"
                })

        # 4. Unknown device detection
        mac_set = set(mac_addresses)
        for mac in active_macs:
            if mac not in mac_set:
                alerts.append({
                    "mac":      mac,
                    "type":     "unknown_device",
                    "severity": "critical",
                    "message":  "Unknown device detected on network"
                })

    return jsonify({"total_alerts": len(alerts), "alerts": alerts})

# -------------------------------
# Run
# -------------------------------
if __name__ == "__main__":
    load_domain_ips()
    app.run(debug=True)