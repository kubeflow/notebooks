import datetime as dt

from kubeflow.kubeflow.crud_backend import api, logging, status
from kubernetes.client.rest import ApiException
from werkzeug.exceptions import Forbidden

log = logging.getLogger(__name__)

EVENT_TYPE_WARNING = "Warning"
STOP_ANNOTATION = "kubeflow-resource-stopped"
# The kubelet's messages while a readiness probe fails or errors, as while a
# server starts
READINESS_PROBE = "Readiness probe "

# Waiting reasons of a container that will not start by itself
# https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-state-waiting
CONTAINER_ERROR_REASONS = {
    "CrashLoopBackOff", "CreateContainerConfigError", "CreateContainerError",
    "ErrImageNeverPull", "ErrImagePull", "ImageInspectError",
    "ImagePullBackOff", "InvalidImageName", "PostStartHookError",
    "PreStartHookError", "RunContainerError",
}


def process_status(notebook, events=None):
    """
    Return status and reason. Status may be:
    [ready|waiting|warning|terminating|stopped]

    events, a NotebookEvents, lets many Notebooks share one events list.
    """
    # In case the Notebook has no status
    status_phase, status_message = get_empty_status(notebook)
    if status_phase is not None:
        return status.create_status(status_phase, status_message)

    # In case the Notebook is being stopped
    status_phase, status_message = get_stopped_status(notebook)
    if status_phase is not None:
        return status.create_status(status_phase, status_message)

    # In case the Notebook is being deleted
    status_phase, status_message = get_deleted_status(notebook)
    if status_phase is not None:
        return status.create_status(status_phase, status_message)

    # In case the Notebook is ready
    status_phase, status_message = check_ready_nb(notebook)
    if status_phase is not None:
        return status.create_status(status_phase, status_message)

    # Extract information about the status from the containerState of the
    # Notebook's status, else from its conditions
    status_phase, status_message = get_status_from_container_state(notebook)
    if status_phase is None:
        status_phase, status_message = get_status_from_conditions(notebook)

    # A step of the start, unless a warning event since tells why it is stuck
    if status_phase == status.STATUS_PHASE.WAITING:
        recent_events = get_recent_events(notebook, events)
        event_phase, event_message = get_status_from_events(recent_events)
        if event_phase is not None:
            return status.create_status(event_phase, event_message)

        readiness_failure = get_readiness_failure(recent_events)
        if readiness_failure:
            status_message = "%s %s" % (status_message, readiness_failure)

    if status_phase is not None:
        return status.create_status(status_phase, status_message)

    # Try to extract information about why the notebook is not starting
    # from the notebook's events (see find_error_event)
    notebook_events = get_notebook_events(notebook, events)
    status_event, reason_event = get_status_from_events(notebook_events)
    if status_event is not None:
        status_phase, status_message = status_event, reason_event
        return status.create_status(status_phase, status_message)

    # In case there no Events available, show a generic message
    status_phase = status.STATUS_PHASE.WARNING
    status_message = "Couldn't find any information for the status of this notebook."  # noqa: E501

    return status.create_status(status_phase, status_message)


def get_empty_status(notebook):
    creation_timestamp = notebook.get("metadata", {}).get("creationTimestamp")
    notebook_status = notebook.get("status", {})
    container_state = notebook_status.get("containerState")
    conditions = notebook_status.get("conditions")

    # Convert a date string of a format to datetime object
    nb_creation_time = dt.datetime.strptime(
        creation_timestamp, "%Y-%m-%dT%H:%M:%SZ")
    current_time = dt.datetime.utcnow().replace(microsecond=0)
    delta = (current_time - nb_creation_time)

    # If the Notebook has no status, the status will be waiting
    # (instead of warning) and we will show a generic message for the first 10
    # seconds
    if not container_state and not conditions and delta.total_seconds() <= 10:
        status_phase = status.STATUS_PHASE.WAITING
        status_message = "Waiting for StatefulSet to create the underlying Pod."  # noqa: E501
        return status_phase, status_message

    return None, None


def get_stopped_status(notebook):
    ready_replicas = notebook.get("status", {}).get("readyReplicas", 0)
    container_state = notebook.get("status", {}).get("containerState")
    metadata = notebook.get("metadata", {})
    annotations = metadata.get("annotations", {})

    if STOP_ANNOTATION in annotations:
        # If the Notebook is stopped, the status will be stopped. A Pod that
        # was not ready yet still has a containerState while it terminates
        if ready_replicas == 0 and not container_state:
            status_phase = status.STATUS_PHASE.STOPPED
            status_message = "No Pods are currently running for this Notebook Server."  # noqa: E501
            return status_phase, status_message
        # If the Notebook is being stopped, the status will be waiting
        else:
            status_phase = status.STATUS_PHASE.WAITING
            status_message = "Notebook Server is stopping."
            return status_phase, status_message

    return None, None


def get_deleted_status(notebook):
    metadata = notebook.get("metadata", {})

    # If the Notebook is being deleted, the status will be terminating
    if "deletionTimestamp" in metadata:
        status_phase = status.STATUS_PHASE.TERMINATING
        status_message = "Deleting this Notebook Server."
        return status_phase, status_message

    return None, None


def check_ready_nb(notebook):
    ready_replicas = notebook.get("status", {}).get("readyReplicas", 0)

    # If the Notebook is running, the status will be ready
    if ready_replicas == 1:
        status_phase, status_message = status.STATUS_PHASE.READY, "Running"
        return status_phase, status_message

    return None, None


def get_status_from_container_state(notebook):
    # https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-states
    container_state = notebook.get("status", {}).get("containerState", {})

    # Running but not ready: its server does not accept connections yet
    if "running" in container_state:
        status_phase = status.STATUS_PHASE.WAITING
        status_message = "Waiting for the server to accept connections."
        return status_phase, status_message

    # The container exited: the status will be warning
    if "terminated" in container_state:
        terminated = container_state["terminated"]
        reason = terminated.get("reason", "Terminated")
        message = terminated.get("message") or "exit code %s" % (
            terminated.get("exitCode"))
        status_phase = status.STATUS_PHASE.WARNING
        status_message = '%s: %s' % (reason, message)
        return status_phase, status_message

    if "waiting" not in container_state:
        return None, None

    # If the container will not start by itself, the status will be warning
    # with a "reason: message" showing on hover
    waiting_state = container_state["waiting"]
    reason = waiting_state.get("reason", "Undefined")
    if reason in CONTAINER_ERROR_REASONS:
        status_phase = status.STATUS_PHASE.WARNING
        message = waiting_state.get(
            "message",
            "No available message for container state."
        )
        status_message = '%s: %s' % (reason, message)
        return status_phase, status_message

    # In any other case it is starting, e.g. PodInitializing, and the status
    # will be waiting
    status_phase = status.STATUS_PHASE.WAITING
    status_message = waiting_state.get("message") or reason
    return status_phase, status_message


def get_status_from_conditions(notebook):
    conditions = notebook.get("status", {}).get("conditions", [])
    with_reason = [c for c in conditions if "reason" in c]

    # An unschedulable Pod will not start by itself: the status will be
    # warning with a "reason: message" showing on hover
    for condition in with_reason:
        if (condition.get("type") == "PodScheduled"
                and condition.get("status") == "False"):
            status_phase = status.STATUS_PHASE.WARNING
            status_message = condition_message(condition)
            return status_phase, status_message

    # Other reasons are steps of a start, e.g. ContainersNotReady
    if with_reason:
        status_phase = status.STATUS_PHASE.WAITING
        status_message = condition_message(with_reason[0])
        return status_phase, status_message

    return None, None


def condition_message(condition):
    return condition["reason"] + ': ' + condition.get("message", "")


class NotebookEvents:
    """The events of the Notebooks of a namespace, listed once, when a status
    first needs them. A user who may not list events gets none."""

    def __init__(self, namespace, notebook=None):
        self.namespace = namespace
        self.notebook = notebook
        self.events = None

    def of(self, notebook):
        if self.events is None:
            self.events = self.list()

        return [e for e in self.events if e.involved_object.name == notebook]

    def list(self):
        try:
            if self.notebook is not None:
                return api.list_notebook_events(
                    self.notebook, self.namespace).items

            return api.list_namespace_notebook_events(self.namespace).items
        except Forbidden:
            log.info("Not allowed to list the events of namespace %s",
                     self.namespace)
        except ApiException as e:
            log.warning("Could not list the events of namespace %s: %s",
                        self.namespace, e.reason)

        return []


def get_notebook_events(notebook, events=None):
    name = notebook["metadata"]["name"]
    namespace = notebook["metadata"]["namespace"]
    if events is None:
        events = NotebookEvents(namespace, name)

    nb_creation_time = dt.datetime.strptime(
        notebook["metadata"]["creationTimestamp"], "%Y-%m-%dT%H:%M:%SZ"
    )

    # User can delete and then create a nb server with the same name
    # Make sure previous events are not taken into account
    return [e for e in events.of(name)
            if event_timestamp(e) >= nb_creation_time]


def get_recent_events(notebook, events=None):
    """The events seen since the Notebook's latest condition change: an older
    warning, e.g. a FailedScheduling before the Pod was scheduled, is no longer
    the cause."""
    since = None
    for condition in notebook.get("status", {}).get("conditions", []):
        if condition.get("lastTransitionTime"):
            transition = dt.datetime.strptime(
                condition["lastTransitionTime"], "%Y-%m-%dT%H:%M:%SZ")
            since = transition if since is None else max(since, transition)

    return [e for e in get_notebook_events(notebook, events)
            if since is None or event_last_seen(e) > since]


def get_status_from_events(notebook_events):
    """
    Returns status and reason from the latest event that surfaces the cause
    of why the resource could not be created. For a Notebook, it can be due to:

          EVENT_TYPE      EVENT_REASON      DESCRIPTION
          Warning         FailedCreate      pods "x" is forbidden: error
            looking up service account ... (originated in statefulset)
          Warning         FailedScheduling  0/1 nodes are available: 1
            Insufficient cpu (originated in pod)

    A failing readiness probe is not a cause: the server is starting.
    """
    for e in sorted(notebook_events, key=event_last_seen, reverse=True):
        if (e.type == EVENT_TYPE_WARNING
                and READINESS_PROBE not in (e.message or "")):
            return status.STATUS_PHASE.WARNING, e.message

    return None, None


def get_readiness_failure(notebook_events):
    """The latest readiness probe failure, without the prefix of an event
    reissued from the Pod."""
    for e in sorted(notebook_events, key=event_last_seen, reverse=True):
        message = e.message or ""
        if READINESS_PROBE in message:
            return message[message.index(READINESS_PROBE):]

    return None


def event_timestamp(event):
    return event.metadata.creation_timestamp.replace(tzinfo=None)


def event_last_seen(event):
    last_seen = (event.last_timestamp or event.event_time
                 or event.metadata.creation_timestamp)
    return last_seen.replace(tzinfo=None)
