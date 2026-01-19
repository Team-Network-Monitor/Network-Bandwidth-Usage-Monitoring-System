import streamlit as st
import threading
import time
import random

# Shared data storage
data_list = []
lock = threading.Lock()

def generate_data():
    """Background thread to generate random names and numbers."""
    counter = 1
    while True:
        with lock:
            random_number = random.randint(100, 999)
            data_list.append({"Name": f"name({counter})", "Number": random_number})
        counter += 1
        time.sleep(1)  # Run every second

def main():
    print(data_list)
    st.title("Multi-threaded Streamlit Table")
    
    if 'data' not in st.session_state:
        st.session_state.data = []
    
    if st.button("Refresh Table"):
        with lock:
            st.session_state.data = list(data_list)  # Copy updated data
    
    st.write("### Data Table")
    st.table(st.session_state.data)

if __name__ == "__main__":
    # Start background thread
    thread = threading.Thread(target=generate_data, daemon=True)
    thread.start()
    
    # Run Streamlit app
    main()