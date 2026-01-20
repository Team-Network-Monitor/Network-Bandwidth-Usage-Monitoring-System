
from collections import defaultdict
import pandas as pd
import threading
import time
import streamlit as st
from scapy.all import sniff, Ether, IP

# Global flag for capturing
capturing_flag = False

data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'mac': None}))  # Store bytes & MAC
captured_packets = []
ips = ['192.168.42.164', '192.168.137.1']

if "data_usage" not in st.session_state:
    st.session_state["data_usage"] = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'mac': None}))
if "captured_packets" not in st.session_state:
    st.session_state["captured_packets"] = []

def process_packet(packet):
    global data_usage, captured_packets
    if packet.haslayer(IP):
        src_ip = packet[IP].src
        dst_ip = packet[IP].dst
        size = len(packet)
        src_mac = packet[Ether].src if packet.haslayer(Ether) else 'Unknown'
        dst_mac = packet[Ether].dst if packet.haslayer(Ether) else 'Unknown'
        
        if src_ip in ips:
            data_usage[src_ip][dst_ip]['bytes'] += size
            data_usage[src_ip][dst_ip]['mac'] = dst_mac
        
        if dst_ip in ips:
            data_usage[dst_ip][src_ip]['bytes'] += size
            data_usage[dst_ip][src_ip]['mac'] = src_mac
        
        if src_ip not in ips and dst_ip not in ips:
            data_usage['other'][src_ip]['bytes'] += size
            data_usage['other'][src_ip]['mac'] = src_mac
            data_usage['other'][dst_ip]['bytes'] += size
            data_usage['other'][dst_ip]['mac'] = dst_mac
        
        captured_packets.append({
            "Source IP": src_ip,
            "Source MAC": src_mac,
            "Destination IP": dst_ip,
            "Destination MAC": dst_mac,
            "Size": size
        })

def start_sniffing():
    global capturing_flag
    while capturing_flag:
        sniff(prn=process_packet, iface="Ethernet 2", timeout=15, store=False)
        time.sleep(1)

def print_stats():
    global capturing_flag
    while capturing_flag:
        time.sleep(15)
        print("\n==== Network Traffic Stats (Last 15 sec) ====")
        for ip, ip_data in data_usage.items():
            if ip != 'other':
                print(f"Group {ip}:")
                for dst_ip, details in ip_data.items():
                    print(f"  To {dst_ip} (MAC: {details['mac']}): {details['bytes']} bytes")
            else:
                print("Other Group:")
                for non_ip, details in ip_data.items():
                    print(f"  {non_ip} (MAC: {details['mac']}): {details['bytes']} bytes")

        if captured_packets:
            print("\nCaptured Packets:")
            for pkt in captured_packets[-5:]:
                print(f"{pkt['Source IP']} ({pkt['Source MAC']}) -> {pkt['Destination IP']} ({pkt['Destination MAC']}), Size: {pkt['Size']} bytes")
        print("==========================================\n")

def start_capture():
    global capturing_flag
    if not capturing_flag:
        capturing_flag = True
        threading.Thread(target=start_sniffing, daemon=True).start()
        threading.Thread(target=print_stats, daemon=True).start()

def stop_capture():
    global capturing_flag
    capturing_flag = False

st.title("Network Traffic Monitor")
if st.button("Start Monitoring"):
    start_capture()
    st.success("Capturing packets... (updates every 15 seconds)")

if st.button("Stop Monitoring"):
    stop_capture()
    st.warning("Stopped capturing packets.")

if st.button("Refresh"):
    st.session_state["data_usage"] = dict(data_usage)
    st.session_state["captured_packets"] = captured_packets
    st.success("Data updated!")

st.subheader("Total Data Usage per IP")
df_usage = pd.DataFrame([(ip, dst_ip, details['mac'], details['bytes']) for ip, ip_data in data_usage.items() for dst_ip, details in ip_data.items()], columns=["Source IP", "Destination IP", "Destination MAC", "Total Data (bytes)"])
st.dataframe(df_usage)

st.subheader("Filter by Specific IP")
filtered_ip = st.text_input("Enter IP to filter:")
if filtered_ip:
    df_filtered = pd.DataFrame([pkt for pkt in st.session_state["captured_packets"] if pkt["Source IP"] == filtered_ip or pkt["Destination IP"] == filtered_ip])
    st.dataframe(df_filtered)

st.subheader("Captured Packets")
df_packets = pd.DataFrame(st.session_state["captured_packets"])
st.dataframe(df_packets)
