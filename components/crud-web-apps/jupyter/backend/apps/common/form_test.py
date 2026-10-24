import unittest

from apps.common import form

PROBE = {"tcpSocket": {"port": 8888}, "periodSeconds": 5}
PROBE_CONFIG = {
    "image": {"readinessProbe": PROBE},
    "imageGroupOne": {"readinessProbe": {"tcpSocket": {"port": 8888}}},
}


def make_notebook(server_type="jupyter"):
    """A Notebook as set_server_type leaves it."""
    return {
        "metadata": {"name": "nb", "namespace": "alice", "annotations": {
            form.SERVER_TYPE_ANNOTATION: server_type}},
        "spec": {"template": {"spec": {
            "containers": [{"name": "nb", "resources": {}}]}}},
    }


class SetReadinessProbeTest(unittest.TestCase):
    def container(self, notebook):
        return notebook["spec"]["template"]["spec"]["containers"][0]

    def test_probe_of_the_server_type(self):
        notebook = make_notebook("jupyter")
        form.set_notebook_readiness_probe(notebook, {}, PROBE_CONFIG)
        self.assertEqual(PROBE, self.container(notebook)["readinessProbe"])

        notebook = make_notebook("group-one")
        form.set_notebook_readiness_probe(notebook, {}, PROBE_CONFIG)
        self.assertEqual({"tcpSocket": {"port": 8888}},
                         self.container(notebook)["readinessProbe"])

    def test_no_probe_configured(self):
        notebook = make_notebook("group-two")
        form.set_notebook_readiness_probe(notebook, {}, PROBE_CONFIG)
        self.assertNotIn("readinessProbe", self.container(notebook))

    def test_probe_is_a_copy(self):
        notebook = make_notebook()
        form.set_notebook_readiness_probe(notebook, {}, PROBE_CONFIG)
        self.container(notebook)["readinessProbe"]["periodSeconds"] = 1
        self.assertEqual(5, PROBE["periodSeconds"])


if __name__ == "__main__":
    unittest.main()
