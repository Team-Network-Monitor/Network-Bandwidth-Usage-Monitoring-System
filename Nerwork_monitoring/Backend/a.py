import socket
import dns.resolver

# Function to clean the domain
def clean_domain(url):
    # Remove http:// or https:// if they exist
    if url.startswith("https://"):
        url = url[8:]
    elif url.startswith("http://"):
        url = url[7:]
    
    # Remove any trailing slashes
    return url.rstrip('/')

# Function to get IP addresses from domain
def get_ip_addresses(domain):
    ip_addresses = []

    # First, try to get the IP using socket
    try:
        ip = socket.gethostbyname(domain)
        ip_addresses.append(ip)
    except socket.gaierror:
        print(f"Could not resolve domain {domain} using socket.")
    
    # Use dns.resolver to get all IP addresses (A records) associated with the domain
    try:
        answers = dns.resolver.resolve(domain, 'A')
        for answer in answers:
            ip_addresses.append(answer.to_text())
    except dns.resolver.NoAnswer:
        print(f"No A records found for domain {domain}.")
    except dns.resolver.NXDOMAIN:
        print(f"Domain {domain} does not exist.")
    
    return ip_addresses

# Example usage
url = "https://channamaduranga.github.io/Portfolio/"
cleaned_domain = clean_domain(url)

ips = get_ip_addresses(cleaned_domain)

if ips:
    print(f"IP addresses for {cleaned_domain}:")
    for ip in ips:
        print(ip)
else:
    print(f"No IP addresses found for {cleaned_domain}.")
