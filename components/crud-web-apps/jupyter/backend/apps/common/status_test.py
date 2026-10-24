import datetime as dt
import unittest
from unittest import mock

from apps.common import status
from kubernetes import client
from kubernetes.client.rest import ApiException
from werkzeug.exceptions import Forbidden


class TestStatusFromContainerState(unittest.TestCase):
    """Test the different cases of status from containerState"""

    def test_terminating_container_state(self):
        container_state = {
            "status": {
                "containerState": {
                    "terminating": {}
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            (None, None)
        )

    def test_running_container_state(self):
        # Reached only when the Notebook is not ready: its server is starting
        container_state = {
            "status": {
                "containerState": {
                    "running": {}
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("waiting", "Waiting for the server to accept connections.")
        )

    def test_terminated_container_state(self):
        container_state = {
            "status": {
                "containerState": {
                    "terminated": {
                        "reason": "OOMKilled",
                        "exitCode": 137,
                    }
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("warning", "OOMKilled: exit code 137")
        )

    def test_terminated_container_state_with_message(self):
        container_state = {
            "status": {
                "containerState": {
                    "terminated": {
                        "reason": "Error",
                        "exitCode": 1,
                        "message": "jupyter: command not found",
                    }
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("warning", "Error: jupyter: command not found")
        )

    def test_starting_container_state(self):
        for reason in ("PodInitializing", "ContainerCreating", "Starting"):
            container_state = {
                "status": {
                    "containerState": {
                        "waiting": {
                            "reason": reason,
                        }
                    }
                }
            }

            self.assertEqual(
                status.get_status_from_container_state(container_state),
                ("waiting", reason)
            )

    def test_no_message_container_state(self):
        container_state = {
            "status": {
                "containerState": {
                    "waiting": {
                        "reason": "ImagePullBackOff",
                    }
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("warning",
             "ImagePullBackOff: No available message for container state.")
        )


class TestStatusFromConditions(unittest.TestCase):
    """Test the different cases of status from the conditions"""

    def test_unschedulable_pod(self):
        notebook = {
            "status": {
                "conditions": [{
                    "type": "PodScheduled",
                    "status": "False",
                    "reason": "Unschedulable",
                    "message": "0/3 nodes are available",
                }]
            }
        }

        self.assertEqual(
            status.get_status_from_conditions(notebook),
            ("warning", "Unschedulable: 0/3 nodes are available")
        )

    def test_starting_pod(self):
        notebook = {
            "status": {
                "conditions": [{
                    "type": "Ready",
                    "status": "False",
                    "reason": "ContainersNotReady",
                    "message": "containers with unready status: [nb]",
                }, {
                    "type": "PodScheduled",
                    "status": "True",
                }]
            }
        }

        self.assertEqual(
            status.get_status_from_conditions(notebook),
            ("waiting",
             "ContainersNotReady: containers with unready status: [nb]")
        )


class TestStoppedStatus(unittest.TestCase):
    """A stopped Notebook is stopping until its Pod is gone"""

    def notebook(self, container_state):
        return {
            "metadata": {"annotations": {status.STOP_ANNOTATION: "x"}},
            "status": {"readyReplicas": 0, "containerState": container_state},
        }

    def test_stopped_while_starting(self):
        self.assertEqual(
            status.get_stopped_status(self.notebook({"running": {}})),
            ("waiting", "Notebook Server is stopping.")
        )

    def test_stopped(self):
        self.assertEqual(
            status.get_stopped_status(self.notebook({}))[0], "stopped")


CREATED = "2024-01-01T10:00:00Z"
SCHEDULED = "2024-01-01T10:01:00Z"


def make_event(kind, reason, message, last_seen, name="nb",
               series=False):
    """An event of the Notebook, last seen at last_seen (HH:MM:SS); a series
    event (events.k8s.io) has an eventTime and no lastTimestamp."""
    last_seen = dt.datetime.strptime("2024-01-01T" + last_seen,
                                     "%Y-%m-%dT%H:%M:%S")
    return client.CoreV1Event(
        metadata=client.V1ObjectMeta(creation_timestamp=last_seen),
        involved_object=client.V1ObjectReference(name=name),
        type=kind, reason=reason, message=message,
        last_timestamp=None if series else last_seen,
        event_time=last_seen if series else None)


def make_notebook(container_state):
    """A Notebook whose Pod was scheduled at 10:01 and is not ready."""
    return {
        "metadata": {"name": "nb", "namespace": "alice",
                     "creationTimestamp": CREATED},
        "status": {
            "containerState": container_state,
            "conditions": [{
                "type": "PodScheduled",
                "status": "True",
                "lastTransitionTime": SCHEDULED,
            }],
        },
    }


class TestProcessStatusWithEvents(unittest.TestCase):
    """A starting Notebook is waiting, unless an event tells why it is stuck"""

    running = {"running": {}}
    creating = {"waiting": {"reason": "ContainerCreating"}}

    def process(self, container_state, *events):
        with mock.patch.object(status.api, "list_notebook_events") as listed:
            listed.return_value = client.CoreV1EventList(items=list(events))
            return status.process_status(make_notebook(container_state))

    def test_waiting_without_events(self):
        result = self.process(self.creating)
        self.assertEqual(("waiting", "ContainerCreating"),
                         (result["phase"], result["message"]))

    def test_a_warning_since_the_last_change_tells_why(self):
        result = self.process(self.creating, make_event(
            "Warning", "FailedMount", "volume not found", "10:03:00"))
        self.assertEqual(("warning", "volume not found"),
                         (result["phase"], result["message"]))

    def test_a_warning_with_an_event_time(self):
        result = self.process(self.creating, make_event(
            "Warning", "FailedMount", "volume not found", "10:03:00",
            series=True))
        self.assertEqual("warning", result["phase"])

    def test_conditions_only(self):
        notebook = make_notebook({})
        notebook["status"]["conditions"].append({
            "type": "Ready", "status": "False",
            "reason": "ContainersNotReady", "message": "unready: [nb]",
            "lastTransitionTime": SCHEDULED,
        })
        with mock.patch.object(status.api, "list_notebook_events") as listed:
            listed.return_value = client.CoreV1EventList(items=[make_event(
                "Warning", "FailedMount", "volume not found", "10:03:00")])
            result = status.process_status(notebook)
        self.assertEqual(("warning", "volume not found"),
                         (result["phase"], result["message"]))

    def test_a_warning_before_the_last_change_is_resolved(self):
        result = self.process(self.creating, make_event(
            "Warning", "FailedScheduling", "unbound PVCs", "10:00:30"))
        self.assertEqual("waiting", result["phase"])

    def test_a_readiness_probe_failure_tells_what_it_waits_for(self):
        result = self.process(self.running, make_event(
            "Warning", "Unhealthy",
            "Reissued from pod/nb-0: Readiness probe failed: connection "
            "refused", "10:02:00"))
        self.assertEqual(
            ("waiting", "Waiting for the server to accept connections. "
                        "Readiness probe failed: connection refused"),
            (result["phase"], result["message"]))

    def test_a_readiness_probe_error_is_part_of_the_start(self):
        result = self.process(self.running, make_event(
            "Warning", "Unhealthy", "Readiness probe errored: exec timeout",
            "10:02:00"))
        self.assertEqual("waiting", result["phase"])

    def test_a_liveness_probe_failure_is_a_warning(self):
        result = self.process(self.running, make_event(
            "Warning", "Unhealthy", "Liveness probe failed: timeout",
            "10:02:00"))
        self.assertEqual(("warning", "Liveness probe failed: timeout"),
                         (result["phase"], result["message"]))

    def test_no_events_when_not_allowed_or_failing(self):
        for error in (Forbidden(), ApiException(status=500)):
            with mock.patch.object(status.api,
                                   "list_notebook_events") as listed:
                listed.side_effect = error
                result = status.process_status(make_notebook(self.creating))
            self.assertEqual("waiting", result["phase"])


class TestNotebookEvents(unittest.TestCase):

    def test_one_list_for_the_namespace(self):
        with mock.patch.object(status.api,
                               "list_namespace_notebook_events") as listed:
            listed.return_value = client.CoreV1EventList(items=[
                make_event("Normal", "Started", "a", "10:02:00", name="a"),
                make_event("Normal", "Started", "b", "10:02:00", name="b"),
            ])
            events = status.NotebookEvents("alice")

            self.assertEqual(["a"], [e.message for e in events.of("a")])
            self.assertEqual(["b"], [e.message for e in events.of("b")])
            listed.assert_called_once_with("alice")

    def test_listed_only_when_needed(self):
        with mock.patch.object(status.api,
                               "list_namespace_notebook_events") as listed:
            status.NotebookEvents("alice")
            listed.assert_not_called()

    def test_no_events_when_not_allowed(self):
        with mock.patch.object(status.api,
                               "list_namespace_notebook_events") as listed:
            listed.side_effect = Forbidden()
            self.assertEqual([], status.NotebookEvents("alice").of("a"))
