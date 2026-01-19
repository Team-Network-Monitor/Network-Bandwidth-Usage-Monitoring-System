

from flask import Flask, jsonify, request
import socket
import dns.resolver
import json
import threading
import time
import random
import re
from scapy.all import sniff, Ether, IP
from collections import defaultdict
from flask_cors import CORS
from scapy.all import sniff, Ether, IP, DNS, UDP, TCP
from scapy.layers.http import HTTPRequest, HTTPResponse
from scapy.all import DNS, DNSQR, DNSRR

app = Flask(__name__)
CORS(app)

# Global storage
data_list = []
running = False
capturing_flag = True
sniffing_thread = None

active_macs = {}

MAC_FILE = 'mac_addresses.json'
BLACKLIST_FILE = 'blacklist.json'





def is_subdomain(domain, parent_domain):
    """Check if domain is a subdomain of parent_domain"""
    if not domain or not parent_domain:
        return False
    return domain == parent_domain or domain.endswith("." + parent_domain)

def normalize_domain(domain):
    """Normalize domain to lowercase and remove leading/trailing dots"""
    if not domain:
        return None
    return domain.lower().strip('.')



# Load MAC addresses from file
def load_mac_addresses():
    try:
        with open(MAC_FILE, "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

# Save MAC addresses to file
def save_mac_addresses(mac_list):
    with open(MAC_FILE, "w") as file:
        json.dump(mac_list, file, indent=4)

# Initialize MAC addresses
mac_addresses = load_mac_addresses()

data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None, 'protocol': 'Unknown'}))
captured_packets = []
domain_ips = {}

# Blacklist management functions
def load_blacklist():
    try:
        with open(BLACKLIST_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'domains': [], 'ips': []}

def save_blacklist(blacklist):
    with open(BLACKLIST_FILE, 'w') as f:
        json.dump(blacklist, f, indent=4)

# Load domain IP mappings
def load_domain_ips():
    global domain_ips
    try:
        with open('domain_ips.json', 'r') as json_file:
            domain_ips = json.load(json_file)
    except (FileNotFoundError, json.JSONDecodeError):
        domain_ips = {}

def save_domain_ips():
    with open('domain_ips.json', 'w') as f:
        json.dump(domain_ips, f, indent=4)

def process_packet(packet):
    global data_usage, captured_packets, domain_ips, active_macs

    if packet.haslayer(Ether):
        src_mac = packet[Ether].src.lower()
        dst_mac = packet[Ether].dst.lower()

        current_time = time.time()
        for mac in [src_mac, dst_mac]:
            if mac in mac_addresses:
                active_macs[mac] = current_time

        size = len(packet)
        
        src_ip = 'Unknown'
        dst_ip = 'Unknown'
        protocol = 'Unknown'

        # Process DNS layer for domain-IP mapping
        if packet.haslayer(DNS):
            dns = packet[DNS]
            if dns.qr == 1:  # Check if it's a DNS response
                # Extract questions and answers
                if dns.an:
                    for answer in dns.an:
                        if answer.type == 1:  # A record (IPv4)
                            domain = answer.rrname.decode('utf-8', errors='ignore').rstrip('.')
                            ip = answer.rdata
                            if isinstance(ip, bytes):
                                ip = socket.inet_ntoa(ip)
                            domain_ips[ip] = domain
                            save_domain_ips()

        if packet.haslayer(IP):
            ip_layer = packet[IP]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
            
            # Determine protocol
            if packet.haslayer(TCP):
                tcp_layer = packet[TCP]
                if tcp_layer.dport == 80 or tcp_layer.sport == 80:
                    protocol = "HTTP"
                elif tcp_layer.dport == 443 or tcp_layer.sport == 443:
                    protocol = "HTTPS"
                else:
                    protocol = "TCP"
            elif packet.haslayer(UDP):
                udp_layer = packet[UDP]
                if udp_layer.dport == 53 or udp_layer.sport == 53:
                    protocol = "DNS"
                else:
                    protocol = "UDP"

        http_info = None
        if packet.haslayer(HTTPRequest):
            http_layer = packet[HTTPRequest]
            http_info = {
                "method": http_layer.Method.decode() if http_layer.Method else "UNKNOWN",
                "host": http_layer.Host.decode() if http_layer.Host else "UNKNOWN",
                "path": http_layer.Path.decode() if http_layer.Path else "UNKNOWN"
            }
        
        captured_packets.append({
            "source_mac": src_mac,
            "dest_mac": dst_mac,
            "source_ip": src_ip,
            "dest_ip": dst_ip,
            "size": size,
            "protocol": protocol,
            "http_info": http_info
        })

        # Update data usage for tracked MACs
        for mac in [src_mac, dst_mac]:
            if mac in mac_addresses:
                target_ip = dst_ip if mac == src_mac else src_ip
                data_usage[mac][target_ip]['bytes'] += size
                data_usage[mac][target_ip]['ip'] = target_ip
                data_usage[mac][target_ip]['protocol'] = protocol

        # Fallback to HTTP Host header if DNS mapping not available
        if http_info and http_info.get('host'):
            domain_ips.setdefault(src_ip, http_info['host'])
            domain_ips.setdefault(dst_ip, http_info['host'])
            save_domain_ips()


def start_sniffing():
    global capturing_flag
    print("Sniffing started")  # Debug print
    while capturing_flag:
        try:
            sniff(prn=process_packet, iface="Ethernet 2", timeout=1, store=False)
        except Exception as e:
            print(f"Sniffing error: {e}")  # Debug print
            if capturing_flag:  # Only continue if we're supposed to be running
                time.sleep(1)
                continue

def get_formatted_data():
    result = {}
    
    for mac in mac_addresses:
        result[mac] = {}
        for ip, details in data_usage[mac].items():
            domain = domain_ips.get(ip, None)
            result[mac][ip] = {
                'bytes': details['bytes'],
                'domain': domain,
                'protocol': details['protocol']
            }
    
    result['others'] = {}
    for ip, details in data_usage['others'].items():
        domain = domain_ips.get(ip, None)
        result['others'][ip] = {
            'bytes': details['bytes'],
            'domain': domain,
            'protocol': details['protocol']
        }
    
    return result

@app.route("/start", methods=["GET"])
def start():
    global running, capturing_flag, sniffing_thread, data_usage, captured_packets, active_macs
    if not running:
        # Reset data structures on start
        data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None, 'protocol': 'Unknown'}))
        captured_packets.clear()
        active_macs.clear()
        running = True
        capturing_flag = True
        if sniffing_thread is None or not sniffing_thread.is_alive():
            sniffing_thread = threading.Thread(target=start_sniffing, daemon=True)
            sniffing_thread.start()
        return jsonify({"message": "Monitoring started!"})
    return jsonify({"message": "Monitoring is already running!"})


@app.route("/active_status", methods=["GET"])
def get_active_status():
    threshold = 300  # 5 minutes
    current_time = time.time()
    blacklist = load_blacklist()
    status = {}
    
    for mac in mac_addresses:
        # Activity status
        last_active = active_macs.get(mac, 0)
        is_active = (current_time - last_active) <= threshold
        
        # Blacklist check
        accessed_blacklist = False
        if mac in data_usage:
            for ip in data_usage[mac].keys():
                # Check IP blacklist
                if ip in blacklist['ips']:
                    accessed_blacklist = True
                    break
                
                # Check domain blacklist
                domain = normalize_domain(domain_ips.get(ip, ""))
                if any(is_subdomain(domain, bl_domain) for bl_domain in blacklist['domains']):
                    accessed_blacklist = True
                    break
        
        status[mac] = {
            "is_active": is_active,
            "accessed_blacklist": accessed_blacklist
        }
        
    return jsonify(status)


@app.route("/stop", methods=["GET"])
def stop_monitoring():
    global running, capturing_flag, sniffing_thread, data_usage, captured_packets, active_macs
    if running:
        print("Stopping monitoring...")
        capturing_flag = False
        running = False
        
        if sniffing_thread is not None:
            sniffing_thread.join(timeout=2.0)
            sniffing_thread = None
        
        # Clear all captured data
        data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None, 'protocol': 'Unknown'}))
        captured_packets.clear()
        active_macs.clear()
        
        return jsonify({
            "message": "Monitoring stopped successfully!",
            "status": "stopped"
        })
    return jsonify({
        "message": "Monitoring was not running!",
        "status": "inactive"
    })


@app.route("/data", methods=["GET"])
def get_data():
    return jsonify(get_formatted_data())

@app.route("/data/<mac_address>", methods=["GET"])
def get_mac_data(mac_address):
    mac_address = mac_address.lower()

    if mac_address in data_usage:
        mac_data = {}
        total_usage = 0

        for ip, details in data_usage[mac_address].items():
            domain = domain_ips.get(ip, None)
            mac_data[ip] = {
                'bytes': details['bytes'],
                'domain': domain,
                'protocol': details['protocol']
            }
            total_usage += details['bytes']

        return jsonify({
            mac_address: mac_data,
            "total_bytes": total_usage
        })
    else:
        return jsonify({"error": "MAC address not found"}), 404

@app.route("/add_mac", methods=["POST"])
def add_mac():
    new_mac = request.json.get("mac", "").lower()
    
    if not re.match(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$", new_mac):
        return jsonify({"error": "Invalid MAC format"}), 400
    
    if new_mac not in mac_addresses:
        mac_addresses.append(new_mac)
        save_mac_addresses(mac_addresses)
        return jsonify({"message": f"MAC {new_mac} added", "macs": mac_addresses})
    
    return jsonify({"message": f"MAC {new_mac} exists", "macs": mac_addresses})

@app.route("/macs", methods=["GET"])
def list_macs():
    return jsonify({"monitored_macs": mac_addresses})

@app.route("/blacklist/domain", methods=["POST"])
def add_blacklist_domain():
    data = request.get_json()
    domains = [normalize_domain(d) for d in data.get('domains', [])]
    
    blacklist = load_blacklist()
    new_domains = [d for d in domains if d and d not in blacklist['domains']]
    blacklist['domains'] += new_domains
    save_blacklist(blacklist)
    
    return jsonify({
        "message": f"Added {len(new_domains)} new domains to blacklist",
        "blacklist": blacklist
    })



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
    
    for mac in mac_addresses:
        accessed = False
        if mac not in data_usage:
            results.append({"mac": mac, "accessed_blacklist": False})
            continue
            
        # Check all IPs/domains this MAC has accessed
        for ip in data_usage[mac].keys():
            # Check blacklisted IPs
            if ip in blacklist['ips']:
                accessed = True
                break
            
            # Check blacklisted domains
            domain = normalize_domain(domain_ips.get(ip, ""))
            if any(is_subdomain(domain, bl_domain) for bl_domain in blacklist['domains']):
                accessed = True
                break
        
        results.append({"mac": mac, "accessed_blacklist": accessed})
    
    return jsonify(results)

if __name__ == "__main__":
    load_domain_ips()
    # mac_addresses = load_mac_addresses()
    # threading.Thread(target=start_sniffing, daemon=True).start()
    app.run(debug=True)