import socket
import threading

def start_health_check_server(port=8000):
    def handle_client(client_socket):
        client_socket.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK")
        client_socket.close()

    def server_thread():
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(("0.0.0.0", port))
        server.listen(5)
        print(f"Health check server listening on port {port}")

        while True:
            client_socket, addr = server.accept()
            handle_client(client_socket)

    thread = threading.Thread(target=server_thread)
    thread.daemon = True
    thread.start()