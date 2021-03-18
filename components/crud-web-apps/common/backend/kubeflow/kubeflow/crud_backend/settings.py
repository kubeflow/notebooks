import os

DISABLE_AUTH = os.getenv("APP_DISABLE_AUTH", "false").lower == "true"
USER_HEADER = os.getenv("USERID_HEADER", "kubeflow-userid")
USER_PREFIX = os.getenv("USERID_PREFIX", ":")
