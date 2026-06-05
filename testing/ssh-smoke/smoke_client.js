// Standalone Node.js WebSocket E2E Smoke Client
// Prerequisites: npm install ws argparse

const WebSocket = require('ws');
const argparse = require('argparse');

// Parse arguments
const parser = new argparse.ArgumentParser({ description: 'Node.js WebSocket SSH Proxy Tunnel Client' });
parser.add_argument('-namespace', { required: true });
parser.add_argument('-workspace', { required: true });
parser.add_argument('-port', { required: true });
parser.add_argument('-server', { required: true });
parser.add_argument('-userid', { default: 'notebooks-admin' });
parser.add_argument('-user-header', { default: 'kubeflow-userid' });
const args = parser.parse_args();

// Determine scheme and host
let server = args.server;
let scheme = "ws";
if (server.startsWith("https://")) {
    scheme = "wss";
    server = server.substring(8);
} else if (server.startsWith("http://")) {
    server = server.substring(7);
}

const url = `${scheme}://${server}/api/v1/workspaces/${args.namespace}/${args.workspace}/connect/${args.port}`;

// Add browser User-Agent spoofing to bypass corporate WAF / proxy security blocks
const headers = {
    [args.user_header]: args.userid,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Determine Origin dynamically to match target server host and pass same-origin check
let serverHost = server;
const slashIndex = server.indexOf('/');
if (slashIndex !== -1) {
    serverHost = server.substring(0, slashIndex);
}
const originProtocol = scheme === 'wss' ? 'https' : 'http';
const originUrl = `${originProtocol}://${serverHost}`;

// Connect WebSocket skipping TLS verification
const ws = new WebSocket(url, {
    headers: headers,
    origin: originUrl,
    rejectUnauthorized: false // skip TLS validation in development
});

// Wrap the secure WebSocket connection inside a standard Node.js Duplex Stream
const duplex = WebSocket.createWebSocketStream(ws);

// Pipe stdin directly to WebSocket, and WebSocket directly to stdout with native backpressure handling
process.stdin.pipe(duplex);
duplex.pipe(process.stdout);

duplex.on('close', () => {
    process.exit(0);
});

duplex.on('error', (err) => {
    console.error('WebSocket Duplex Stream Error:', err);
    process.exit(1);
});
