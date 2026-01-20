from flask import Flask, request, jsonify
from flask_cors import CORS  # Enable CORS for cross-origin requests

app = Flask(__name__)
CORS(app)  # Allow all origins (for development)

# Start Monitoring Endpoint
@app.route('/start', methods=['GET'])
def start_monitoring():
    return jsonify({"message": "Monitoring started"})

# Fetch Live Data Endpoint
@app.route('/data', methods=['GET'])
def get_data():
    sample_data = {
        "00:1A:2B:3C:4D:5E": {
            "192.168.1.10": {"protocol": "TCP", "bytes": 10485760},
            "192.168.1.11": {"protocol": "UDP", "bytes": 5242880}
        },
        "00:1A:2B:3C:4D:5F": {
            "192.168.1.20": {"protocol": "TCP", "bytes": 2097152}
        }
    }
    return jsonify(sample_data)

# Save Domain to Blacklist
@app.route('/save_domain', methods=['POST'])
def save_domain():
    data = request.json
    domain = data.get("domain", "")
    if domain:
        return jsonify({"message": f"Domain '{domain}' saved!"})
    return jsonify({"message": "Invalid domain"}), 400

if __name__ == '__main__':
    app.run(debug=True)
