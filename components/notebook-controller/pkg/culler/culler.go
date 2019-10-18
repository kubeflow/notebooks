package culler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/kubeflow/kubeflow/components/notebook-controller/pkg/metrics"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	logf "sigs.k8s.io/controller-runtime/pkg/runtime/log"
)

var log = logf.Log.WithName("culler")
var client = &http.Client{
	Timeout: time.Second * 10,
}

// The constants with name 'DEFAULT_{ENV_Var}' are the default values to be
// used, if the respective ENV vars are not present.
// All the time numbers correspond to minutes.
const DEFAULT_IDLE_TIME = "1440" // One day
const DEFAULT_CULLING_CHECK_PERIOD = "1"
const DEFAULT_ENABLE_CULLING = "false"
const DEFAULT_CLUSTER_DOMAIN = "cluster.local"

// When a Resource should be stopped/culled, then the controller should add this
// annotation in the Resource's Metadata. Then, inside the reconcile loop,
// the controller must check if this annotation is set and then apply the
// respective culling logic for that Resource. The value of the annotation will
// be a timestamp of when the Resource was stopped/culled.
//
// In case of Notebooks, the controller will reduce the replicas to 0 if
// this annotation is set. If it's not set, then it will make the replicas 1.
const STOP_ANNOTATION = "kubeflow-resource-stopped"

type NotebookStatus struct {
	Started      string `json:"started"`
	LastActivity string `json:"last_activity"`
	Connections  int    `json:"connections"`
	Kernels      int    `json:"kernels"`
}

// Some Utility Functions
func getEnvDefault(variable string, defaultVal string) string {
	envVar := os.Getenv(variable)
	if len(envVar) == 0 {
		return defaultVal
	}
	return envVar
}

// Time / Frequency Utility functions
func createTimestamp() string {
	now := time.Now()
	return now.Format(time.RFC3339)
}

func GetRequeueTime() time.Duration {
	// The frequency in which we check if the Pod needs culling
	// Uses ENV var: CULLING_CHECK_PERIOD
	cullingPeriod := getEnvDefault(
		"CULLING_CHECK_PERIOD", DEFAULT_CULLING_CHECK_PERIOD)
	realCullingPeriod, err := strconv.Atoi(cullingPeriod)
	if err != nil {
		log.Info(fmt.Sprintf(
			"Culling Period should be Int. Got '%s'. Using default value.",
			cullingPeriod))
		realCullingPeriod, _ = strconv.Atoi(DEFAULT_CULLING_CHECK_PERIOD)
	}

	return time.Duration(realCullingPeriod) * time.Minute
}

func getMaxIdleTime() time.Duration {
	idleTime := getEnvDefault("IDLE_TIME", DEFAULT_IDLE_TIME)
	realIdleTime, err := strconv.Atoi(idleTime)
	if err != nil {
		log.Info(fmt.Sprintf(
			"IDLE_TIME should be Int. Got %s instead. Using default value.",
			idleTime))
		realIdleTime, _ = strconv.Atoi(DEFAULT_IDLE_TIME)
	}

	return time.Minute * time.Duration(realIdleTime)
}

// Stop Annotation handling functions
func SetStopAnnotation(meta *metav1.ObjectMeta, m *metrics.Metrics) {
	if meta == nil {
		log.Info("Error: Metadata is Nil. Can't set Annotations")
		return
	}
	t := time.Now()
	if meta.GetAnnotations() != nil {
		meta.Annotations[STOP_ANNOTATION] = t.Format(time.RFC3339)
	} else {
		meta.SetAnnotations(map[string]string{
			STOP_ANNOTATION: t.Format(time.RFC3339),
		})
	}
	if m != nil {
		m.NotebookCullingCount.WithLabelValues(meta.Namespace, meta.Name).Inc()
		m.NotebookCullingTimestamp.WithLabelValues(meta.Namespace, meta.Name).Set(float64(t.Unix()))
	}
}

func RemoveStopAnnotation(meta *metav1.ObjectMeta) {
	if meta == nil {
		log.Info("Error: Metadata is Nil. Can't remove Annotations")
		return
	}

	if meta.GetAnnotations() == nil {
		return
	}

	if _, ok := meta.GetAnnotations()[STOP_ANNOTATION]; ok {
		delete(meta.GetAnnotations(), STOP_ANNOTATION)
	}
}

func StopAnnotationIsSet(meta metav1.ObjectMeta) bool {
	if meta.GetAnnotations() == nil {
		return false
	}

	if _, ok := meta.GetAnnotations()[STOP_ANNOTATION]; ok {
		return true
	} else {
		return false
	}
}

// Culling Logic
func getNotebookApiStatus(nm, ns string) *NotebookStatus {
	// Get the Notebook Status from the Server's /api/status endpoint
	domain := getEnvDefault("CLUSTER_DOMAIN", DEFAULT_CLUSTER_DOMAIN)
	url := fmt.Sprintf(
		"http://%s.%s.svc.%s/notebook/%s/%s/api/status",
		nm, ns, domain, ns, nm)

	resp, err := client.Get(url)
	if err != nil {
		log.Info(fmt.Sprintf("Error talking to %s", url), "error", err)
		return nil
	}

	// Decode the body
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		log.Info(fmt.Sprintf(
			"Warning: GET to %s: %d", url, resp.StatusCode))
		return nil
	}

	status := new(NotebookStatus)
	err = json.NewDecoder(resp.Body).Decode(status)
	if err != nil {
		log.Info(fmt.Sprintf(
			"Error parsing the JSON response for Notebook %s/%s", nm, ns),
			"error", err)
		return nil
	}

	return status
}

func notebookIsIdle(nm, ns string, status *NotebookStatus) bool {
	// Being idle means that the Notebook can be culled
	if status == nil {
		return false
	}

	lastActivity, err := time.Parse(time.RFC3339, status.LastActivity)
	if err != nil {
		log.Info(fmt.Sprintf("Error parsing time for Notebook %s/%s", nm, ns),
			"error", err)
		return false
	}

	timeCap := lastActivity.Add(getMaxIdleTime())
	if time.Now().After(timeCap) {
		return true
	}
	return false
}

func NotebookNeedsCulling(nbMeta metav1.ObjectMeta) bool {
	if getEnvDefault("ENABLE_CULLING", DEFAULT_ENABLE_CULLING) != "true" {
		log.Info("Culling of idle Pods is Disabled. To enable it set the " +
			"ENV Var 'ENABLE_CULLING=true'")
		return false
	}

	nm, ns := nbMeta.GetName(), nbMeta.GetNamespace()
	if StopAnnotationIsSet(nbMeta) {
		log.Info(fmt.Sprintf("Notebook %s/%s is already stopping", ns, nm))
		return false
	}

	notebookStatus := getNotebookApiStatus(nm, ns)
	return notebookIsIdle(nm, ns, notebookStatus)
}
