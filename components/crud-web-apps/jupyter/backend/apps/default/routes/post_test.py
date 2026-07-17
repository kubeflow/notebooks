import unittest
from unittest import mock

from flask import Flask

from apps.default.routes import post


FORM_SETTERS = (
    "set_notebook_image",
    "set_notebook_image_pull_policy",
    "set_server_type",
    "set_notebook_cpu",
    "set_notebook_memory",
    "set_notebook_gpus",
    "set_notebook_tolerations",
    "set_notebook_affinity",
    "set_notebook_configurations",
    "set_notebook_shm",
)


class TestPostPVC(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def test_same_pvc_mounted_at_multiple_paths_adds_one_volume(self):
        api_volumes = [
            {
                "mount": "/data",
                "existingSource": {
                    "persistentVolumeClaim": {
                        "claimName": "shared-pvc",
                    },
                },
            },
            {
                "mount": "/backup",
                "existingSource": {
                    "persistentVolumeClaim": {
                        "claimName": "shared-pvc",
                    },
                },
            },
        ]
        notebook = {
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{}],
                    },
                },
            },
        }

        with self.app.test_request_context(
            "/api/namespaces/test-namespace/notebooks",
            method="POST",
            json={"name": "test-notebook"},
        ):
            with (
                mock.patch.object(
                    post.helpers,
                    "load_param_yaml",
                    return_value=notebook,
                ),
                mock.patch.object(
                    post.utils,
                    "load_spawner_ui_config",
                    return_value={},
                ),
                mock.patch.object(
                    post.form,
                    "get_form_value",
                    side_effect=[api_volumes, None],
                ),
                mock.patch.object(
                    post.authn,
                    "get_username",
                    return_value="user@example.com",
                ),
                mock.patch.object(
                    post.api,
                    "create_notebook",
                ) as create_notebook,
                mock.patch.multiple(
                    post.form,
                    **{name: mock.DEFAULT for name in FORM_SETTERS},
                ),
            ):
                post.post_pvc("test-namespace")

        created_notebook = create_notebook.call_args.args[0]
        pod_spec = created_notebook["spec"]["template"]["spec"]

        self.assertEqual(
            [volume["name"] for volume in pod_spec["volumes"]],
            ["shared-pvc"],
        )
        self.assertEqual(
            [
                mount["mountPath"]
                for mount in pod_spec["containers"][0]["volumeMounts"]
            ],
            ["/data", "/backup"],
        )
        self.assertEqual(
            {
                mount["name"]
                for mount in pod_spec["containers"][0]["volumeMounts"]
            },
            {"shared-pvc"},
        )
