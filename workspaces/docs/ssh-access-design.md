# Secure TCP Port Forwarding (Tunneling) for Kubeflow Workspaces

This document describes the design, security, and usage of the secure TCP port forwarding (tunneling) feature for Kubeflow Workspaces, with SSH access as a primary use case.

## Architecture Overview

Instead of exposing raw TCP ports (such as port 22 for SSH, port 8080 for custom tools, debuggers, or databases) directly via an Ingress or load balancer, this feature establishes a **secure TCP-over-WebSocket tunnel** proxied via the `workspaces-backend` API service. 

### How it works
1. The client initiates a connection request targeting a specific Workspace and target port.
2. The `workspaces-backend` dynamically retrieves the Kubernetes `Service` associated with the Workspace (looked up using the `notebooks.kubeflow.org/workspace-name` label selector).
3. The backend upgrades the connection to a WebSocket and dials the target port on the resolved Service cluster IP, proxying TCP traffic bidirectionally.

### Request Flow

```mermaid
sequence diagram
    actor User
    participant Client as ws-port-forward CLI Client
    participant Gateway as Ingress Gateway / Istio
    participant Backend as workspaces-backend (API Server)
    participant K8sDNS as CoreDNS / K8s Service
    participant Pod as Workspace Pod (Notebook)

    User->>Client: Connect to workspace-name on port 22/other
    Client->>Backend: HTTP GET /api/v1/workspaces/{ns}/{name}/connect/{port} (with Auth Headers)
    Note over Backend: Validates OIDC AuthN & RBAC (VerbConnect on Workspaces)
    Backend-->>Client: 101 Switching Protocols (Upgrade to WebSocket)
    Backend->>K8sDNS: Dial TCP to {resolved-service-name}.{ns}.svc.cluster.local:{port}
    K8sDNS->>Pod: Establishes TCP handshake to target port (e.g. 22)
    Backend-->>Client: Bidirectional Proxy established
    Client<->Backend: WebSocket Binary Frames
    Backend<->Pod: Raw TCP Stream
```

---

## Key Design & Security Considerations

1. **OIDC & RBAC Enforcement**
   * The `/api/v1/workspaces/:namespace/:name/connect/:port` endpoint is fully authenticated via OIDC.
   * Authorization is delegated via SubjectAccessReviews (`SAR`). The user must possess the explicit `connect` verb on the `workspaces` resource in the target namespace.
2. **Dynamic Service Lookup**
   * Instead of hardcoding service names or routing rules, the backend queries the API server for the `Service` matching the Workspace's unique label: `notebooks.kubeflow.org/workspace-name: <workspace-name>`.
   * This guarantees that port-forwarding requests are routed dynamically to the correct Service and Pods even if the underlying service name is customized.
3. **Elimination of Kubernetes API `exec` Privilege**
   * Rather than exposing high-privilege Kubernetes API access (like `pods/exec`), the tunnel works strictly at the network layer, adhering to the principle of least privilege.

---

## Primary Example: Secure SSH Access

A very common use case for secure port-forwarding is establishing an SSH session into the workspace.

### Step 1: Create your SSH Public Key Secret
Upload your public SSH key to a Kubernetes Secret in your target namespace:
```bash
kubectl create secret generic kubeflow-ssh-pub-my-workspace \
  --namespace=my-namespace \
  --from-file=authorized_keys=~/.ssh/id_kubeflow.pub
```

### Step 2: Configure Workspace for SSH
Configure your Workspace container to run `sshd` and authorize keys from the mounted Secret path. The workspace controller automatically mounts the secret named `kubeflow-ssh-pub-<workspace-name>` to `/home/jovyan/.ssh/authorized_keys` if it exists in the namespace.

### Step 3: Establish the SSH Tunnel
Use the `ws-port-forward` CLI utility to bridge your local port to the workspace container's SSH daemon:
```bash
# Starts a local listener on localhost:2222 tunneling to port 22 on the workspace service
./ws-port-forward \
  -server "https://kubeflow.myorg.com/workspaces" \
  -namespace "my-namespace" \
  -workspace "my-workspace" \
  -port "22"
```

Now, you can connect securely using your standard SSH client:
```bash
ssh -p 2222 jovyan@localhost -i ~/.ssh/id_kubeflow
```
