FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y openssh-server

# Create jovyan user
RUN useradd -u 1000 -m -d /home/jovyan -s /bin/bash jovyan

# Create host key and config directory (outside shadowed home directory mount)
RUN mkdir -p /etc/ssh-smoke && chown -R jovyan:jovyan /etc/ssh-smoke

USER 1000
WORKDIR /home/jovyan

# Generate SSH host keys in a user-writable directory (since we run as non-root)
RUN ssh-keygen -q -N "" -t rsa -b 4096 -f /etc/ssh-smoke/ssh_host_rsa_key && \
    ssh-keygen -q -N "" -t ecdsa -f /etc/ssh-smoke/ssh_host_ecdsa_key && \
    ssh-keygen -q -N "" -t ed25519 -f /etc/ssh-smoke/ssh_host_ed25519_key

# Create a non-root SSH configuration file in /etc/ssh-smoke/
RUN echo "Port 2222" > /etc/ssh-smoke/sshd_config && \
    echo "HostKey /etc/ssh-smoke/ssh_host_rsa_key" >> /etc/ssh-smoke/sshd_config && \
    echo "HostKey /etc/ssh-smoke/ssh_host_ecdsa_key" >> /etc/ssh-smoke/sshd_config && \
    echo "HostKey /etc/ssh-smoke/ssh_host_ed25519_key" >> /etc/ssh-smoke/sshd_config && \
    echo "PidFile /etc/ssh-smoke/sshd.pid" >> /etc/ssh-smoke/sshd_config && \
    echo "UsePAM no" >> /etc/ssh-smoke/sshd_config && \
    echo "PasswordAuthentication no" >> /etc/ssh-smoke/sshd_config && \
    echo "PubkeyAuthentication yes" >> /etc/ssh-smoke/sshd_config && \
    echo "AuthorizedKeysFile /home/jovyan/.ssh/authorized_keys" >> /etc/ssh-smoke/sshd_config && \
    echo "StrictModes no" >> /etc/ssh-smoke/sshd_config

EXPOSE 2222
CMD ["/usr/sbin/sshd", "-D", "-e", "-f", "/etc/ssh-smoke/sshd_config"]
