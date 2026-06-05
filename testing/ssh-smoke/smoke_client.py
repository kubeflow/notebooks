# Standalone Python WebSocket E2E Smoke Client
# Utilizing standard robust websocket-client package

import sys
import argparse
import threading
from websocket import create_connection

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-namespace", required=True)
    parser.add_argument("-workspace", required=True)
    parser.add_argument("-port", required=True)
    parser.add_argument("-server", required=True)
    parser.add_argument("-userid", default="notebooks-admin")
    parser.add_argument("-user-header", default="kubeflow-userid")
    args = parser.parse_args()

    # Determine scheme and host
    server = args.server
    scheme = "ws"
    if server.startswith("https://"):
        scheme = "wss"
        server = server.replace("https://", "", 1)
    elif server.startswith("http://"):
        server = server.replace("http://", "", 1)

    url = f"{scheme}://{server}/api/v1/workspaces/{args.namespace}/{args.workspace}/connect/{args.port}"

    # Connect with authentication headers and skip TLS verification (InsecureSkipVerify equivalent)
    ws = create_connection(
        url,
        header=[f"{args.user_header}: {args.userid}"],
        sslopt={"cert_reqs": 0} # Bypass self-signed TLS validations in development
    )

    # WebSocket -> Stdout (Synchronous binary stream reader)
    def ws_to_stdout():
        try:
            while True:
                data = ws.recv()
                if not data:
                    break
                sys.stdout.buffer.write(data if isinstance(data, bytes) else data.encode())
                sys.stdout.buffer.flush()
        except Exception:
            pass
        finally:
            ws.close()

    t = threading.Thread(target=ws_to_stdout)
    t.daemon = True
    t.start()

    # Stdin -> WebSocket (Synchronous binary stream writer)
    try:
        while True:
            # Read raw bytes immediately from stdin buffer
            buf = sys.stdin.buffer.raw.read(4096)
            if not buf:
                break
            ws.send_binary(buf)
    except Exception:
        pass
    finally:
        ws.close()

if __name__ == "__main__":
    main()
