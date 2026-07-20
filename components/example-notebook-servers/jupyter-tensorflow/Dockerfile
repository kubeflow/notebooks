#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<jupyter>
FROM $BASE_IMG

# args - software versions
# https://github.com/tensorflow/tensorflow/releases
ARG TENSORFLOW_VERSION=2.21.0

# install - tensorflow
RUN PIP_NO_CACHE_DIR=off python3 -m pip install --quiet --no-cache-dir \
    tensorflow==${TENSORFLOW_VERSION}

# install - requirements.txt
COPY --chown=${NB_USER}:${NB_GID} requirements.txt /tmp
RUN PIP_NO_CACHE_DIR=off python3 -m pip install -r /tmp/requirements.txt --quiet --no-cache-dir \
 && rm -f /tmp/requirements.txt