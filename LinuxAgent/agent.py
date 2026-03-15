import time
import json
import threading
import urllib.request
import socket
import platform
import psutil
import getpass
import os
from collections import defaultdict
from scapy.all import sniff, DNS, DNSQR, IP, TCP, UDP

# ─── Config ───────────────────────────────────────────────────────────────────
SEND_INTERVAL  = 5
TOP_N_PROCS    = 10
CACHE_REFRESH  = 0.5

# ─── Shared state ─────────────────────────────────────────────────────────────
lock                = threading.Lock()
interval_dns        = set()
interval_proc_bytes = defaultdict(lambda: {"upload": 0, "download": 0})
proc_total_bytes    = defaultdict(lambda: {"upload": 0, "download": 0})
port_pid_cache      = {}
_local_ip           = None
_iface              = None
io_baseline         = None

# ─── Utilities ────────────────────────────────────────────────────────────────

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())

def get_mac():
    for iface, addrs in psutil.net_if_addrs().items():
        if iface == "lo":
            continue
        for addr in addrs:
            if (addr.family == psutil.AF_LINK
                    and addr.address not in ("", "00:00:00:00:00:00")):
                return addr.address.replace("-", ":").lower()
    return "00:00:00:00:00:00"

def get_username():
    try:
        # On Linux getpass.getuser() returns the actual user even under sudo
        return os.environ.get("SUDO_USER") or getpass.getuser()
    except Exception:
        return "Unknown"

def get_interface(local_ip):
    """Find the network interface that has the given IP."""
    for iface, addrs in psutil.net_if_addrs().items():
        if iface == "lo":
            continue
        for addr in addrs:
            if addr.family == socket.AF_INET and addr.address == local_ip:
                return iface
    return None

def pid_to_name(pid):
    try:
        return psutil.Process(pid).name()
    except Exception:
        return f"PID-{pid}"

def check_root():
    if os.geteuid() != 0:
        print("Error: agent must be run as root (use sudo)")
        exit(1)

# ─── Thread 1: port→PID cache refresher ──────────────────────────────────────

def port_cache_refresher():
    global port_pid_cache
    while True:
        cache = {}
        try:
            for conn in psutil.net_connections(kind="inet"):
                if conn.pid and conn.laddr:
                    cache[conn.laddr.port] = conn.pid
        except Exception:
            pass
        port_pid_cache = cache
        time.sleep(CACHE_REFRESH)

# ─── Thread 2: Scapy sniffer ──────────────────────────────────────────────────

def packet_callback(pkt):
    if pkt.haslayer(DNS) and pkt.haslayer(DNSQR):
        qname = pkt[DNSQR].qname.decode(errors="ignore").rstrip(".")
        if qname:
            with lock:
                interval_dns.add(qname)
        return

    if not pkt.haslayer(IP):
        return

    src, dst = pkt[IP].src, pkt[IP].dst
    length   = len(pkt)

    src_port = dst_port = None
    if pkt.haslayer(TCP):
        src_port, dst_port = pkt[TCP].sport, pkt[TCP].dport
    elif pkt.haslayer(UDP):
        src_port, dst_port = pkt[UDP].sport, pkt[UDP].dport

    is_upload   = (src == _local_ip)
    is_download = (dst == _local_ip)
    if not (is_upload or is_download):
        return

    local_port = src_port if is_upload else dst_port
    if local_port is None:
        return

    pid = port_pid_cache.get(local_port)
    if pid is None:
        return

    name = pid_to_name(pid)
    key  = "upload" if is_upload else "download"
    with lock:
        interval_proc_bytes[name][key] += length
        proc_total_bytes[name][key]    += length

def start_sniffer():
    print(f"[scapy] Sniffing on interface: {_iface}")
    sniff(
        prn=packet_callback,
        store=False,
        filter="ip",
        iface=_iface,      # explicit interface — more reliable on Linux
    )

# ─── Send to master ───────────────────────────────────────────────────────────

def _send(master_ip, master_port, payload):
    url = f"http://{master_ip}:{master_port}/usage"
    try:
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(url, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, data=data, timeout=5) as resp:
            response   = json.loads(resp.read().decode("utf-8"))
            collecting = response.get("collecting", True)
            print(f"[{time.strftime('%X')}] "
                  f"↑{payload['usage']['upload']:.0f} B/s  "
                  f"↓{payload['usage']['download']:.0f} B/s  "
                  f"procs={len(payload['process'])}  "
                  f"dns={len(payload['dns'])}  "
                  f"| {'LIVE' if collecting else 'STOPPED'}")
            return collecting
    except Exception as e:
        print(f"[{time.strftime('%X')}] Send failed: {e}")
        return None

# ─── Reporter ─────────────────────────────────────────────────────────────────

def reporter(master_ip, master_port, hostname, local_ip, mac, username):
    global interval_proc_bytes, interval_dns, proc_total_bytes, io_baseline
    was_collecting = True

    while True:
        with lock:
            interval_proc_bytes.clear()
            interval_dns.clear()

        io_before = psutil.net_io_counters()
        time.sleep(SEND_INTERVAL)
        io_after  = psutil.net_io_counters()

        system_upload   = io_after.bytes_sent - io_before.bytes_sent
        system_download = io_after.bytes_recv - io_before.bytes_recv
        upload_bps      = round(system_upload   / SEND_INTERVAL, 2)
        download_bps    = round(system_download / SEND_INTERVAL, 2)

        io_now     = psutil.net_io_counters()
        total_up   = max(0, io_now.bytes_sent - io_baseline.bytes_sent)
        total_down = max(0, io_now.bytes_recv - io_baseline.bytes_recv)

        with lock:
            proc_interval_snap = {k: dict(v) for k, v in interval_proc_bytes.items()}
            proc_total_snap    = {k: dict(v) for k, v in proc_total_bytes.items()}
            dns_snapshot       = list(interval_dns)

        raw_total_up   = sum(v["upload"]   for v in proc_interval_snap.values()) or 1
        raw_total_down = sum(v["download"] for v in proc_interval_snap.values()) or 1
        scale_up   = system_upload   / raw_total_up   if raw_total_up   > system_upload   else 1.0
        scale_down = system_download / raw_total_down if raw_total_down > system_download else 1.0

        all_proc_names = set(proc_interval_snap) | set(proc_total_snap)
        top_procs = sorted(
            all_proc_names,
            key=lambda n: (
                proc_interval_snap.get(n, {}).get("upload",   0) +
                proc_interval_snap.get(n, {}).get("download", 0)
            ),
            reverse=True
        )[:TOP_N_PROCS]

        process_list = []
        for name in top_procs:
            iv  = proc_interval_snap.get(name, {"upload": 0, "download": 0})
            tot = proc_total_snap.get(name,    {"upload": 0, "download": 0})
            process_list.append({
                "name":  name,
                "speed": {
                    "upload":   round(iv["upload"]   * scale_up   / SEND_INTERVAL, 2),
                    "download": round(iv["download"] * scale_down / SEND_INTERVAL, 2),
                },
                "total": {
                    "upload":   round(tot["upload"]   * scale_up),
                    "download": round(tot["download"] * scale_down),
                }
            })

        payload = {
            "timestamp":   round(time.time()),
            "name":        hostname,
            "username":    username,
            "ip":          local_ip,
            "mac":         mac,
            "os":          platform.system(),
            "state":       "sending",
            "usage":       {"upload": upload_bps,  "download": download_bps},
            "total_usage": {"upload": total_up,    "download": total_down},
            "process":     process_list,
            "dns":         dns_snapshot,
        }

        collecting = _send(master_ip, master_port, payload)

        if collecting is None:
            continue

        if not collecting:
            if was_collecting:
                print(f"[{time.strftime('%X')}] Stopped — resetting data...")
                with lock:
                    proc_total_bytes.clear()
                    interval_proc_bytes.clear()
                    interval_dns.clear()
                io_baseline    = psutil.net_io_counters()
                was_collecting = False
        else:
            if not was_collecting:
                print(f"[{time.strftime('%X')}] Resumed — starting fresh...")
                io_baseline    = psutil.net_io_counters()
                was_collecting = True

# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    global _local_ip, _iface, io_baseline

    check_root()

    print("=== Network Usage Agent (Linux) ===")
    master_ip   = input("Master IP   : ").strip()
    master_port = input("Master port [5000]: ").strip() or "5000"

    hostname  = socket.gethostname()
    _local_ip = get_local_ip()
    mac       = get_mac()
    username  = get_username()
    _iface    = get_interface(_local_ip)

    if not _iface:
        print(f"Warning: could not detect interface for {_local_ip}, using default")
        _iface = None  # Scapy will use default

    print(f"\n  Host      : {hostname}")
    print(f"  User      : {username}")
    print(f"  IP        : {_local_ip}")
    print(f"  MAC       : {mac}")
    print(f"  Interface : {_iface or 'auto'}")
    print(f"  OS        : {platform.system()}")
    print(f"  Master    : {master_ip}:{master_port}")
    print(f"\n  Starting...\n")

    io_baseline = psutil.net_io_counters()

    threading.Thread(target=port_cache_refresher, daemon=True).start()
    threading.Thread(target=start_sniffer,        daemon=True).start()

    reporter(master_ip, master_port, hostname, _local_ip, mac, username)

if __name__ == "__main__":
    main()