from collections import defaultdict
import pandas as pd
import threading
import time
import streamlit as st
from scapy.all import sniff, Ether, IP

# Global flag for capturing
capturing_flag = False

data_usage = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None}))  # Store bytes & IP
captured_packets = []
mac_addresses = ['72:30:6a:87:28:83', '94:e7:0b:0e:0e:43']  # Replace with actual MAC addresses

if "data_usage" not in st.session_state:
    st.session_state["data_usage"] = defaultdict(lambda: defaultdict(lambda: {'bytes': 0, 'ip': None}))
if "captured_packets" not in st.session_state:
    st.session_state["captured_packets"] = []

def process_packet(packet):
    global data_usage, captured_packets
    if packet.haslayer(Ether):
        src_mac = packet[Ether].src
        dst_mac = packet[Ether].dst
        size = len(packet)
        src_ip = packet[IP].src if packet.haslayer(IP) else 'Unknown'
        dst_ip = packet[IP].dst if packet.haslayer(IP) else 'Unknown'
        
        if src_mac in mac_addresses:
            data_usage[src_mac][dst_mac]['bytes'] += size
            data_usage[src_mac][dst_mac]['ip'] = dst_ip
        
        if dst_mac in mac_addresses:
            data_usage[dst_mac][src_mac]['bytes'] += size
            data_usage[dst_mac][src_mac]['ip'] = src_ip
        
        if src_mac not in mac_addresses and dst_mac not in mac_addresses:
            data_usage['other'][src_mac]['bytes'] += size
            data_usage['other'][src_mac]['ip'] = src_ip
            data_usage['other'][dst_mac]['bytes'] += size
            data_usage['other'][dst_mac]['ip'] = dst_ip
        
        captured_packets.append({
            "Source MAC": src_mac,
            "Source IP": src_ip,
            "Destination MAC": dst_mac,
            "Destination IP": dst_ip,
            "Size": size
        })

def start_sniffing():
    global capturing_flag
    while capturing_flag:
        sniff(prn=process_packet, iface="Wi-Fi", timeout=15, store=False)
        time.sleep(1)

def print_stats():
    global capturing_flag
    while capturing_flag:
        time.sleep(15)
        print("\n==== Network Traffic Stats (Last 15 sec) ====")
        for mac, mac_data in data_usage.items():
            if mac != 'other':
                print(f"Group {mac}:")
                for dst_mac, details in mac_data.items():
                    print(f"  To {dst_mac} (IP: {details['ip']}): {details['bytes']} bytes")
            else:
                print("Other Group:")
                for non_mac, details in mac_data.items():
                    print(f"  {non_mac} (IP: {details['ip']}): {details['bytes']} bytes")

        if captured_packets:
            print("\nCaptured Packets:")
            for pkt in captured_packets[-5:]:
                print(f"{pkt['Source MAC']} ({pkt['Source IP']}) -> {pkt['Destination MAC']} ({pkt['Destination IP']}), Size: {pkt['Size']} bytes")
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

st.subheader("Total Data Usage per MAC Address")
df_usage = pd.DataFrame([(mac, dst_mac, details['ip'], details['bytes']) for mac, mac_data in data_usage.items() for dst_mac, details in mac_data.items()], columns=["Source MAC", "Destination MAC", "Destination IP", "Total Data (bytes)"])
st.dataframe(df_usage)

st.subheader("Filter by Specific MAC Address")
filtered_mac = st.text_input("Enter MAC Address to filter:")
if filtered_mac:
    df_filtered = pd.DataFrame([pkt for pkt in st.session_state["captured_packets"] if pkt["Source MAC"] == filtered_mac or pkt["Destination MAC"] == filtered_mac])
    st.dataframe(df_filtered)

st.subheader("Captured Packets")
df_packets = pd.DataFrame(st.session_state["captured_packets"])
st.dataframe(df_packets)
