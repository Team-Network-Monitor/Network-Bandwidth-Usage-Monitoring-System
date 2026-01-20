from scapy.all import sniff, Ether

def packet_callback(packet):
    if packet.haslayer(Ether):
        print(f"Source MAC: {packet[Ether].src} -> Destination MAC: {packet[Ether].dst}")

sniff(iface="Ethernet 2", prn=packet_callback, store=0)
