#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<jupyter>
FROM $BASE_IMG

ARG TARGETARCH

# args - software versions
#  - TensorFlow CUDA version matrix: https://www.tensorflow.org/install/source#gpu
#  - Extra PyPi from NVIDIA (for TensorRT): https://pypi.nvidia.com/
#  - TODO: TensorRT will be removed from TensorFlow in 2.18.0
#          when updating past that version, either remove all TensorRT related packages,
#          or investigate if there is a way to keep TensorRT support
ARG TENSORFLOW_VERSION=2.17.1
ARG TENSORRT_VERSION=10.2.0
ARG TENSORRT_LIBS_VERSION=10.2.0
ARG TENSORRT_BINDINGS_VERSION=10.2.0

# nvidia container toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html
ENV NVIDIA_VISIBLE_DEVICES all
ENV NVIDIA_DRIVER_CAPABILITIES compute,utility
ENV NVIDIA_REQUIRE_CUDA "cuda>=12.3"

# install - tensorflow
#  - About '[and-cuda]' option: https://github.com/tensorflow/tensorflow/blob/v2.17.1/tensorflow/tools/pip_package/setup.py#L153-L164
RUN python3 -m pip install --quiet --no-cache-dir --extra-index-url https://pypi.nvidia.com \
    tensorflow[and-cuda]==${TENSORFLOW_VERSION} \
    tensorrt-cu12==${TENSORRT_VERSION} \
    tensorrt-cu12-libs==${TENSORRT_LIBS_VERSION} \
    tensorrt-cu12-bindings==${TENSORRT_BINDINGS_VERSION}

# create symlinks for TensorRT libs
#  - https://github.com/tensorflow/tensorflow/issues/61986#issuecomment-1880489731
#  - We are creating symlinks for the following libs, as this is where TF looks for them:
#     - libnvinfer.so.10.2.0 -> libnvinfer.so.10
#     - libnvinfer_plugin.so.10.2.0 -> libnvinfer_plugin.so.10
ENV PYTHON_SITE_PACKAGES /opt/conda/lib/python3.12/site-packages
ENV TENSORRT_LIBS ${PYTHON_SITE_PACKAGES}/tensorrt_libs
RUN ln -s ${TENSORRT_LIBS}/libnvinfer.so.${TENSORRT_LIBS_VERSION%%.*} ${TENSORRT_LIBS}/libnvinfer.so.${TENSORRT_LIBS_VERSION} \
 && ln -s ${TENSORRT_LIBS}/libnvinfer_plugin.so.${TENSORRT_LIBS_VERSION%%.*} ${TENSORRT_LIBS}/libnvinfer_plugin.so.${TENSORRT_LIBS_VERSION}

# envs - cudnn, tensorrt
ENV LD_LIBRARY_PATH=${LD_LIBRARY_PATH:+${LD_LIBRARY_PATH}:}${TENSORRT_LIBS}

# install - requirements.txt
COPY --chown=${NB_USER}:${NB_GID} requirements.txt /tmp
RUN python3 -m pip install -r /tmp/requirements.txt --quiet --no-cache-dir \
 && rm -f /tmp/requirements.txt