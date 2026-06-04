#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<base>
FROM $BASE_IMG

ARG TARGETARCH

# args - software versions
# https://github.com/coder/code-server/releases
ARG CODESERVER_VERSION=4.121.0

USER root

# install - code-server
RUN curl -fsSL "https://github.com/coder/code-server/releases/download/v${CODESERVER_VERSION}/code-server_${CODESERVER_VERSION}_${TARGETARCH}.deb" -o /tmp/code-server.deb \
 && dpkg -i /tmp/code-server.deb \
 && rm -f /tmp/code-server.deb

# create non-pvc user data directory
# NOTE: code-server stores user-specific configs like extensions in `$XDG_DATA_HOME/code-server`,
#       but this directory is backed by a shared PVC at runtime, so to avoid conflicts and ensure the notebook starts with
#       expected extensions and configs, we set `XDG_DATA_HOME` to a directory that is not backed by a PVC.
# NOTE: this has a similar effect to code-server `--user-data-dir`, but also changes the path of the `heartbeat` file
#       and `coder-logs` folder which do not respect that arg: https://github.com/coder/code-server/issues/6834
ENV XDG_DATA_HOME "/tmp/data-${NB_USER}"
RUN mkdir -p "${XDG_DATA_HOME}" \
 && chown ${NB_USER}:${NB_GID} "${XDG_DATA_HOME}" \
 && chmod 770 "${XDG_DATA_HOME}"

# s6 - copy scripts
COPY --chown=${NB_USER}:${NB_GID} --chmod=755 s6/ /etc

USER $NB_UID

EXPOSE 8888