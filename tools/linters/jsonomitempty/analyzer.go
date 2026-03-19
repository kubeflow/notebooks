// Copyright 2024.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package jsonomitempty provides a Go analysis pass that reports slice fields
// whose json struct tag is missing the "omitempty" option.
package jsonomitempty

import (
	"go/ast"
	"reflect"
	"slices"
	"strings"

	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

// Analyzer reports slice fields that have a json tag without "omitempty".
var Analyzer = &analysis.Analyzer{
	Name:     "jsonomitempty",
	Doc:      `checks that slice fields with json tags include the "omitempty" option`,
	Requires: []*analysis.Analyzer{inspect.Analyzer},
	Run:      run,
}

func run(pass *analysis.Pass) (any, error) {
	insp := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)

	nodeFilter := []ast.Node{(*ast.StructType)(nil)}

	insp.Preorder(nodeFilter, func(n ast.Node) {
		structType := n.(*ast.StructType)
		for _, field := range structType.Fields.List {
			if _, ok := field.Type.(*ast.ArrayType); !ok {
				continue
			}
			if field.Tag == nil {
				continue
			}
			tag := reflect.StructTag(strings.Trim(field.Tag.Value, "`"))
			jsonTag := tag.Get("json")
			if jsonTag == "" || jsonTag == "-" {
				continue
			}
			parts := strings.Split(jsonTag, ",")
			if slices.Contains(parts[1:], "omitempty") {
				continue
			}
			name := "<anonymous>"
			if len(field.Names) > 0 {
				name = field.Names[0].Name
			}
			pass.Reportf(field.Pos(), "slice field %q has json tag %q but is missing omitempty", name, jsonTag)
		}
	})

	return nil, nil
}
