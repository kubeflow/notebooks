import unittest

from apps.common import status


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

    def test_ready_container_state(self):
        container_state = {
            "status": {
                "containerState": {
                    "running": {}
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            (None, None)
        )

    def test_pod_initializing_container_state(self):
        container_state = {
            "status": {
                "containerState": {
                    "waiting": {
                        "reason": "PodInitializing",
                    }
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("waiting", "PodInitializing")
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

    def test_waiting_container_state_with_message(self):
        container_state = {
            "status": {
                "containerState": {
                    "waiting": {
                        "reason": "ImagePullBackOff",
                        "message": "Back-off pulling image",
                    }
                }
            }
        }

        self.assertEqual(
            status.get_status_from_container_state(container_state),
            ("warning", "ImagePullBackOff: Back-off pulling image")
        )
