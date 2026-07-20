#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<jupyter>
FROM $BASE_IMG

# install - usefull linux packages
USER root
RUN apt-get -yq update \
 && apt-get -yq install --no-install-recommends \
    # for latex
    cm-super \
    dvipng \
    # for matplotlib
    ffmpeg \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
USER $NB_UID

# install - conda packages
# NOTE: we use mamba to speed things up
RUN mamba install -y -q \
    altair \
    beautifulsoup4==4.14.3 \
    bokeh==3.9.0 \
    bottleneck \
    brotli \
    cloudpickle \
    dask==2026.3.0 \
    dill \
    h5py \
    ipympl \
    matplotlib==3.10.9 \
    numba \
    numexpr \
    numpy==2.4.6 \
    openblas==0.3.28 \
    openpyxl \
    pandas==3.0.3 \
    patsy \
    protobuf \
    pytables==3.11.1 \
    scikit-image==0.26.0 \
    scikit-learn==1.8.0 \
    scipy==1.17.1 \
    seaborn==0.13.2 \
    sqlalchemy==2.0.50 \
    statsmodels \
    sympy \
    vincent \
    xgboost==3.2.0 \
    xlrd \
 && mamba clean -a -f -y

# install - requirements.txt
COPY --chown=${NB_USER}:${NB_GID} requirements.txt /tmp
RUN PIP_NO_CACHE_DIR=off python3 -m pip install -r /tmp/requirements.txt --quiet --no-cache-dir \
 && rm -f /tmp/requirements.txt