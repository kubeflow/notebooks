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
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("DetectGraphCycle", func() {

	It("should detect a simple cycle", func() {
		startNode := "A"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "A"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(Equal([]string{"A", "B", "C"}))
	})

	It("should return nil for no cycle", func() {
		startNode := "A"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "D"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(BeNil())
		Expect(checkedNodes).To(Equal(map[string]bool{"A": true, "B": true, "C": true, "D": true}))
	})

	It("should detect a self-loop cycle", func() {
		startNode := "A"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "A"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(Equal([]string{"A"}))
	})

	It("should detect a cycle and ignore unconnected nodes", func() {
		startNode := "A"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "A", "D": "E"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(Equal([]string{"A", "B", "C"}))
	})

	It("should detect cycles starting from different nodes in a complex graph", func() {
		startNode := "A"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "D", "D": "B", "E": "F"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(Equal([]string{"B", "C", "D"}))

		startNode = "E"
		result = DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(BeNil())
		Expect(checkedNodes).To(Equal(map[string]bool{"E": true, "F": true}))
	})

	It("should detect cycles in a graph with multiple components", func() {
		startNode := "X"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "D", "D": "B", "X": "Y", "Y": "Z"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(BeNil())
		Expect(checkedNodes).To(Equal(map[string]bool{"X": true, "Y": true, "Z": true}))

		startNode = "A"
		result = DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(Equal([]string{"B", "C", "D"}))
	})

	It("should return nil when starting from a node with no outgoing edge", func() {
		startNode := "Z"
		checkedNodes := map[string]bool{}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "D", "D": "B", "X": "Y"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(BeNil())
		Expect(checkedNodes).To(Equal(map[string]bool{"Z": true}))
	})

	It("should return nil when the start node has already been checked", func() {
		startNode := "A"
		checkedNodes := map[string]bool{"A": true, "B": true}
		edgeMap := map[string]string{"A": "B", "B": "C", "C": "D", "D": "B"}

		result := DetectGraphCycle(startNode, checkedNodes, edgeMap)
		Expect(result).To(BeNil())
		Expect(checkedNodes).To(Equal(map[string]bool{"A": true, "B": true}))
	})
})
