package models

import (
	"testing"
)

func TestGetOrDefaultWithRecovery(t *testing.T) {
	// Test case 1: Value is non-nil, should return the value
	nonNilValue := 42
	result := GetOrDefaultWithRecovery(&nonNilValue, 0)
	if result != 42 {
		t.Errorf("Expected 42, got %d", result)
	}

	// Test case 2: Value is nil, should return the default value
	result = GetOrDefaultWithRecovery[int](nil, 99)
	if result != 99 {
		t.Errorf("Expected 99, got %d", result)
	}

	// Test case 3: Simulate a panic and ensure recovery works
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Function did not handle panic as expected")
		}
	}()
	result = GetOrDefaultWithRecovery[int](nil, 123) // Should not panic
	if result != 123 {
		t.Errorf("Expected 123, got %d", result)
	}

	// Test case 4-5: Value is one of models structs.
	dummy_image_config1 := ImageConfigValue{
		Id:          "jupyterlab_scipy_180",
		DisplayName: "JupyterLab, with SciPy Packages",
		Labels:      map[string]string{"python_version": "3.11"},
	}
	hidden_result := GetOrDefaultWithRecovery(dummy_image_config1.Hidden, false)
	if hidden_result {
		t.Errorf("Expected false, got %v", hidden_result)
	}
	id_result := GetOrDefaultWithRecovery(&dummy_image_config1.Id, "dummy_id")
	if id_result != "jupyterlab_scipy_180" {
		t.Errorf("Expected 'jupyterlab_scipy_180', got %v", id_result)
	}
}
