from scapy.all import sniff, Ether, IP

# Function to handle each packet
def packet_callback(packet):
    # Only handle packets with Ethernet layer
    if packet.haslayer(Ether):
        src_mac = packet[Ether].src
        dst_mac = packet[Ether].dst

        # Default IPs if not present
        src_ip = dst_ip = "N/A"

        # If the packet has IP layer, get IPs
        if packet.haslayer(IP):
            src_ip = packet[IP].src
            dst_ip = packet[IP].dst

        print(f"MAC: {src_mac} -> {dst_mac} | IP: {src_ip} -> {dst_ip}")
        print("-" * 50)

# Replace 'Ethernet 2' with your actual interface name
iface_name = "Wi-Fi"

print(f"[*] Sniffing on interface: {iface_name}")
sniff(iface=iface_name, prn=packet_callback, store=False)
