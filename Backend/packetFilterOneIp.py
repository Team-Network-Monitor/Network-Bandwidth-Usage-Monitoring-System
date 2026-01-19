from scapy.all import sniff
from scapy.layers.inet import IP
import socket


LOCAL_IP = socket.gethostbyname(socket.gethostname())

def capture_traffic(target_ip):
    """Captures traffic and tracks data usage for the entered target IP."""
    total_packet_size = 0 
    ip_data_usage = {}  

    def packet_callback(packet):
        nonlocal total_packet_size, ip_data_usage

        if IP in packet:
            src_ip = packet[IP].src
            dst_ip = packet[IP].dst
            packet_size = len(packet)

           
            if src_ip == target_ip or dst_ip == target_ip:
                other_ip = src_ip if dst_ip == target_ip else dst_ip 
                
               
                ip_data_usage[other_ip] = ip_data_usage.get(other_ip, 0) + packet_size
                
                
                total_packet_size += packet_size

    print(f"\nTracking traffic for {target_ip}... Press Enter to stop and enter a new IP.")

    # Start sniffing until the user presses Enter
    sniff(prn=packet_callback, filter="ip", store=0, stop_filter=lambda x: False)

    # Display summary when user presses Enter
    input("\nPress Enter to stop and see the summary...")

    # Display summary
    print("\n===== SUMMARY =====")
    print(f"Total data exchanged by {target_ip}: {total_packet_size} bytes")
    print("Data usage per IP:")
    if ip_data_usage:
        for ip, size in sorted(ip_data_usage.items(), key=lambda item: item[1], reverse=True):
            print(f"- {ip}: {size} bytes")
    else:
        print("No data captured.")
    print("=" * 40)

def main():
    input("Press Enter to start capturing traffic...")

    while True:
        target_ip = input("Enter the target IP to track: ").strip()
        if not target_ip:
            print("Invalid input. Please enter a valid IP address.")
            continue

        capture_traffic(target_ip)

if __name__ == "__main__":
    main()
