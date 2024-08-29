package helper

import (
	"bytes"
	"fmt"
	"text/template"
)

// RenderExtraEnvValueTemplate renders a single WorkspaceKind `spec.podTemplate.extraEnv[].value` string template
func RenderExtraEnvValueTemplate(rawValue string, httpPathPrefixFunc func(string) string) (string, error) {

	// Parse the raw value as a template
	tmpl, err := template.New("value").
		Funcs(template.FuncMap{"httpPathPrefix": httpPathPrefixFunc}).
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
