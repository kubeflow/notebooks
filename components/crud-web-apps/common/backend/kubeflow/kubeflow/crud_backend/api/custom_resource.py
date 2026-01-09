import re
from flask import request
from kubeflow.kubeflow.crud_backend import errors
from .. import authz
from . import custom_api


def create_custom_rsrc(group, version, kind, data, namespace):
    authz.ensure_authorized("create", group, version, kind, namespace)
    return custom_api.create_namespaced_custom_object(group, version,
                                                      namespace, kind, data)


def delete_custom_rsrc(group, version, kind, name, namespace,
                       policy="Foreground"):
    authz.ensure_authorized("delete", group, version, kind, namespace)
    return custom_api.delete_namespaced_custom_object(
        group, version, namespace, kind, name, propagation_policy=policy
    )


def list_custom_rsrc(group, version, kind, namespace):
    namespace_filter = request.args.get("namespaceFilter")

    if namespace_filter:
        if (
            len(namespace_filter) > 63
            or not re.match(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$', namespace_filter)
        ):
            raise errors.UnprocessableEntity(
                "Invalid Kubernetes namespace name for namespaceFilter"
            )
    
        if kind.lower() == "workspacekinds":
            authz.ensure_authorized(
                "create",
                "kubeflow.org",
                "v1beta1",
                "workspaces",
                namespace_filter,
            )
        else:
            authz.ensure_authorized("list", group, version, kind, namespace)
    else:
        authz.ensure_authorized("list", group, version, kind, namespace)
    
    return custom_api.list_namespaced_custom_object(
        group, version, namespace, kind
    )


def get_custom_rsrc(group, version, kind, namespace, name): 
    authz.ensure_authorized("get", group, version, kind, namespace)

    return custom_api.get_namespaced_custom_object(group, version, namespace,
                                                   kind, name)
