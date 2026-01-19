import scapy.all as scapy
import threading
import queue
import time

# Create a queue to store packet details
packet_queue = queue.Queue()

# Function to capture packets
def capture_packets():
    # Start sniffing packets in real-time, and put the packet details into the queue
    scapy.sniff(prn=lambda pkt: packet_queue.put(extract_packet_details(pkt)), store=0)

# Function to extract source, destination, and packet size
def extract_packet_details(packet):
    # Extract the source, destination, and packet size if the packet has an IP layer
    if packet.haslayer(scapy.IP):
        source = packet[scapy.IP].src
        destination = packet[scapy.IP].dst
        size = len(packet)
        return source, destination, size
    return None

# Function to visualize packet details in real-time
def visualize_packet_details():
    while True:
        # Get packet details from the queue (blocking if the queue is empty)
        packet_details = packet_queue.get()
        
        if packet_details:
            source, destination, size = packet_details
            print(f"Source: {source} -> Destination: {destination} | Packet Size: {size} bytes")
        
        # Sleep to give some time for other processes (like packet capturing) to run
        time.sleep(0.1)

# Main function to start the packet capturing and visualization
def main():
    # Start packet capture in a separate thread
    capture_thread = threading.Thread(target=capture_packets, daemon=True)
    capture_thread.start()

    # Start the visualization function in the main thread
    visualize_packet_details()

if __name__ == "__main__":
    main()
