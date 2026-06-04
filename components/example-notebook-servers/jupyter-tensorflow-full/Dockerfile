#
# NOTE: Use the Makefiles to build this image correctly.
#

ARG BASE_IMG=<jupyter-tensorflow>
FROM $BASE_IMG

# install - conda packages
# NOTE: we use mamba to speed things up
RUN mamba install -y -q \
    bokeh==3.9.0 \
    cloudpickle==3.1.2 \
    dill==0.4.1 \
    ipympl==0.10.0 \
    matplotlib==3.10.9 \
    numpy==2.4.6 \
    pandas==3.0.3 \
    scikit-image==0.26.0 \
    scikit-learn==1.8.0 \
    scipy==1.17.1 \
    seaborn==0.13.2 \
    xgboost==3.2.0 \
 && mamba clean -a -f -y

# install - requirements.txt
COPY --chown=${NB_USER}:${NB_GID} requirements.txt /tmp/requirements.txt
RUN PIP_NO_CACHE_DIR=off python3 -m pip install -r /tmp/requirements.txt --quiet --no-cache-dir \
 && rm -f /tmp/requirements.txt
