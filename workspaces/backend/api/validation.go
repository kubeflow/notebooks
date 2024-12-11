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

package api

import (
	"fmt"
	"unicode/utf8"
)

// ValidateKubernetesResourceName validates one or more Kubernetes resource names.
// It ensures each name meets the following criteria:
// 1. The name must not contain non-ASCII characters.
// 2. The name must not exceed 255 characters in length.
func ValidateKubernetesResourceName(params ...string) error {
	for _, param := range params {
		if err := NonASCIIValidator(param); err != nil {
			return err
		}
		if err := LengthValidator(param); err != nil {
			return err
		}
	}
	return nil
}

// NonASCIIValidator checks if a given string contains only ASCII characters.
func NonASCIIValidator(param string) error {
	if utf8.ValidString(param) && len(param) == len([]rune(param)) {
		return nil
	}
	return fmt.Errorf("Invalid value: '%s' contains non-ASCII characters.", param)
}

// LengthValidator ensures a given string does not exceed 255 characters.
func LengthValidator(param string) error {
	if len(param) > 255 {
		return fmt.Errorf("Invalid value: '%s' exceeds the allowed limit of 255 characters.", param)
	}

	return nil
}
