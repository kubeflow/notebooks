package helper

import (
	"bytes"
	"fmt"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"text/template"
)

// RenderWithHttpPathPrefixFunc renders a string template using templateFunc (Go template function).
func RenderWithHttpPathPrefixFunc(rawValue string, templateFunc func(portId string) string) (string, error) {

	// Parse the raw value as a template
	tmpl, err := template.New("value").
		Funcs(template.FuncMap{"httpPathPrefix": templateFunc}).
		Parse(rawValue)
	if err != nil {
		err = fmt.Errorf("failed to parse template %q: %w", rawValue, err)
		return "", err
	}

	// Execute the template
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, nil)
	if err != nil {
		err = fmt.Errorf("failed to execute template %q: %w", rawValue, err)
		return "", err
	}

	return buf.String(), nil
}

// RenderHeadersWithHttpPathPrefix renders a map[string]string values using httpPathPrefixFunc Go template function.
func RenderHeadersWithHttpPathPrefix(requestHeaders map[string]string, templateFunc func(v string) string) map[string]string {

	if len(requestHeaders) == 0 {
		return make(map[string]string, 0)
	}

	headers := make(map[string]string, len(requestHeaders))
	for key, value := range requestHeaders {
		if value != "" {
			out, err := RenderWithHttpPathPrefixFunc(value, templateFunc)
			if err != nil {
				return make(map[string]string)
			}
			value = out
		}
		headers[key] = value
	}
	return headers
}

// GenerateHttpPathPrefixFunc generates the httpPathPrefix Go template function.
func GenerateHttpPathPrefixFunc(workspace *kubefloworgv1beta1.Workspace, containerPortsIdMap map[string]kubefloworgv1beta1.ImagePort) func(portId string) string {
	return func(portId string) string {
		port, ok := containerPortsIdMap[portId]
		if ok {
			return fmt.Sprintf("/workspace/%s/%s/%s/", workspace.Namespace, workspace.Name, port.Id)
		} else {
			return ""
		}
	}
}
