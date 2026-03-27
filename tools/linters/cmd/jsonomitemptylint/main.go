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

package main

import (
	"flag"
	"fmt"
	"go/token"
	"os"
	"path/filepath"
	"strings"

	"github.com/kubeflow/notebooks/tools/linters/jsonomitempty"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/packages"
)

func main() {
	flag.Parse()
	patterns := flag.Args()
	if len(patterns) == 0 {
		patterns = []string{"."}
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "getwd: %v\n", err)
		os.Exit(1)
	}

	fset := token.NewFileSet()
	cfg := &packages.Config{
		Mode: packages.NeedName |
			packages.NeedFiles |
			packages.NeedCompiledGoFiles |
			packages.NeedTypes |
			packages.NeedTypesSizes |
			packages.NeedSyntax |
			packages.NeedTypesInfo,
		Fset: fset,
	}

	pkgs, err := packages.Load(cfg, patterns...)
	if err != nil {
		fmt.Fprintf(os.Stderr, "load: %v\n", err)
		os.Exit(1)
	}

	exitCode := 0
	for _, pkg := range pkgs {
		if len(pkg.Errors) > 0 {
			for _, e := range pkg.Errors {
				fmt.Fprintln(os.Stderr, e)
			}
			exitCode = 1
			continue
		}

		// inspect.Analyzer is a required dependency of jsonomitempty.Analyzer.
		inspectPass := &analysis.Pass{
			Analyzer:   inspect.Analyzer,
			Fset:       fset,
			Files:      pkg.Syntax,
			Pkg:        pkg.Types,
			TypesInfo:  pkg.TypesInfo,
			TypesSizes: pkg.TypesSizes,
			ResultOf:   map[*analysis.Analyzer]any{},
			Report:     func(analysis.Diagnostic) {},
		}
		inspectResult, err := inspect.Analyzer.Run(inspectPass)
		if err != nil {
			fmt.Fprintf(os.Stderr, "inspect: %v\n", err)
			exitCode = 1
			continue
		}

		var diagnostics []analysis.Diagnostic
		mainPass := &analysis.Pass{
			Analyzer:   jsonomitempty.Analyzer,
			Fset:       fset,
			Files:      pkg.Syntax,
			Pkg:        pkg.Types,
			TypesInfo:  pkg.TypesInfo,
			TypesSizes: pkg.TypesSizes,
			ResultOf:   map[*analysis.Analyzer]any{inspect.Analyzer: inspectResult},
			Report:     func(d analysis.Diagnostic) { diagnostics = append(diagnostics, d) },
		}
		if _, err := jsonomitempty.Analyzer.Run(mainPass); err != nil {
			fmt.Fprintf(os.Stderr, "jsonomitempty: %v\n", err)
			exitCode = 1
			continue
		}

		for _, d := range diagnostics {
			pos := fset.Position(d.Pos)
			rel, err := filepath.Rel(cwd, pos.Filename)
			if err != nil {
				rel = pos.Filename
			}
			if isUnderTestDir(rel) {
				continue
			}
			fmt.Printf("./%s:%d:%d: %s\n", rel, pos.Line, pos.Column, d.Message)
			exitCode = 1
		}
	}

	os.Exit(exitCode)
}

// isUnderTestDir reports whether the given (relative) file path has a
// path component named "test".
func isUnderTestDir(path string) bool {
	for _, part := range strings.Split(filepath.ToSlash(path), "/") {
		if part == "test" {
			return true
		}
	}
	return false
}
