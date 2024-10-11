package helper

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = ginkgo.Describe("helper", func() {

	ginkgo.It("should render request headers correctly", func() {

		containerPortsIdMap := make(map[string]kubefloworgv1beta1.ImagePort)
		containerPortsIdMap["rstudio"] = kubefloworgv1beta1.ImagePort{
			Port: 8080,
			Id:   "rstudio",
		}

		headers := map[string]string{"X-RStudio-Root-Path": `{{ httpPathPrefix "rstudio" }}`}

		ws := &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "simple",
				Namespace: "default",
			},
		}

		function := GenerateHttpPathPrefixFunc(ws, containerPortsIdMap)

		out := RenderHeadersWithHttpPathPrefix(headers, function)

		gomega.Expect(out["X-RStudio-Root-Path"]).To(gomega.Equal("/workspace/default/simple/rstudio/"))
	})
})
