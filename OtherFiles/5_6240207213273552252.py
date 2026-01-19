from flask import Flask, jsonify, request
from flask_cors import CORS
import socket
import dns.resolver
import json
import threading
import time
import random
from scapy.all import sniff, Ether, IP
from collections import defaultdict

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Global storage for data
data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None}))  # Store bytes & IP
captured_packets = []
mac_addresses = ['92:55:26:49:f1:7c', 'dc:4a:3e:43:bf:9c', 'dc:4a:3e:43:bf:be', 'dc:4a:3e:45:b1:da', 'dc:4a:3e:45:b2:3c']
domain_ips = {}
restricted_domain = []


def load_domain_ips():
    global domain_ips
    try:
        with open('domain_ips.json', 'r') as json_file:
            domain_ips = json.load(json_file)
    except FileNotFoundError:
        domain_ips = {}

def process_packet(packet):
    global data_usage, captured_packets
    if packet.haslayer(Ether):
        src_mac = packet[Ether].src
        dst_mac = packet[Ether].dst
        size = len(packet)
        src_ip = packet[IP].src if packet.haslayer(IP) else 'Unknown'
        dst_ip = packet[IP].dst if packet.haslayer(IP) else 'Unknown'
        
        # Get protocol type
        protocol = "Unknown"
        if packet.haslayer(IP):
            if packet[IP].proto == 6:
                protocol = "TCP"
            elif packet[IP].proto == 17:
                protocol = "UDP"
            elif packet[IP].proto == 1:
                protocol = "ICMP"
        
        # Process packet data
        if src_mac in mac_addresses:
            if dst_ip not in data_usage[src_mac]:
                data_usage[src_mac][dst_ip] = {'bytes': 0, 'protocol': protocol}
            data_usage[src_mac][dst_ip]['bytes'] += size
            data_usage[src_mac][dst_ip]['ip'] = dst_ip
            data_usage[src_mac][dst_ip]['protocol'] = protocol

        if dst_mac in mac_addresses:
            if src_ip not in data_usage[dst_mac]:
                data_usage[dst_mac][src_ip] = {'bytes': 0, 'protocol': protocol}
            data_usage[dst_mac][src_ip]['bytes'] += size
            data_usage[dst_mac][src_ip]['ip'] = src_ip
            data_usage[dst_mac][src_ip]['protocol'] = protocol

        if src_mac not in mac_addresses and dst_mac not in mac_addresses:
            if src_ip not in data_usage['other']:
                data_usage['other'][src_ip] = {'bytes': 0, 'protocol': protocol}
            if dst_ip not in data_usage['other']:
                data_usage['other'][dst_ip] = {'bytes': 0, 'protocol': protocol}
            
            data_usage['other'][src_ip]['bytes'] += size
            data_usage['other'][src_ip]['ip'] = src_ip
            data_usage['other'][src_ip]['protocol'] = protocol
            data_usage['other'][dst_ip]['bytes'] += size
            data_usage['other'][dst_ip]['ip'] = dst_ip
            data_usage['other'][dst_ip]['protocol'] = protocol

        captured_packets.append({
            "Source MAC": src_mac,
            "Source IP": src_ip,
            "Destination MAC": dst_mac,
            "Destination IP": dst_ip,
            "Size": size,
            "Protocol": protocol
        })

def start_sniffing():
    while True:
        sniff(prn=process_packet, timeout=15, store=False)
        time.sleep(1)

@app.route("/start", methods=["GET"])
def start():
    threading.Thread(target=start_sniffing, daemon=True).start()
    return jsonify({"message": "Network monitoring started!"})

def clean_domain(url):
    if url.startswith("https://"):
        url = url[8:]
    elif url.startswith("http://"):
        url = url[7:]
    return url.rstrip('/')

def get_ip_addresses(domain):
    ip_addresses = []
    try:
        ip = socket.gethostbyname(domain)
        ip_addresses.append(ip)
    except socket.gaierror:
        print(f"Could not resolve domain {domain}.")
    
    try:
        answers = dns.resolver.resolve(domain, 'A')
        for answer in answers:
            ip_addresses.append(answer.to_text())
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        print(f"Error resolving domain {domain}.")
    
    return ip_addresses

@app.route("/save_domain", methods=["POST"])
def save_domain():
    domain = request.json.get("domain")
    if domain:
        cleaned_domain = clean_domain(domain)
        ips = get_ip_addresses(cleaned_domain)
        if ips:
            domain_ips[cleaned_domain] = ips
            with open('domain_ips.json', 'w') as json_file:
                json.dump(domain_ips, json_file, indent=4)
            return jsonify({"message": f"IP addresses for {cleaned_domain} saved!"})
        else:
            return jsonify({"message": f"No IP addresses found for {cleaned_domain}."}), 404
    return jsonify({"message": "No domain provided."}), 400

@app.route("/data", methods=["GET"])
def get_data():
    return jsonify(data_usage)

if __name__ == "__main__":
    app.run(debug=True)
