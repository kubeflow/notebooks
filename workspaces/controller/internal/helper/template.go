/*
Copyright 2024.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
