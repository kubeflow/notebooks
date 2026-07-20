#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<jupyter>
FROM $BASE_IMG

ARG TARGETARCH

# args - software versions
#  - TensorFlow CUDA version matrix: https://www.tensorflow.org/install/source#gpu
ARG TENSORFLOW_VERSION=2.21.0

# nvidia container toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV NVIDIA_REQUIRE_CUDA "cuda>=12.5"

# install - tensorflow
#  - About '[and-cuda]' option: https://github.com/tensorflow/tensorflow/blob/v2.21.0/tensorflow/tools/pip_package/setup.py.tpl#L162-L176
RUN PIP_NO_CACHE_DIR=off python3 -m pip install --quiet --no-cache-dir \
    tensorflow[and-cuda]==${TENSORFLOW_VERSION}

# install - requirements.txt
COPY --chown=${NB_USER}:${NB_GID} requirements.txt /tmp
RUN PIP_NO_CACHE_DIR=off python3 -m pip install -r /tmp/requirements.txt --quiet --no-cache-dir \
 && rm -f /tmp/requirements.txt