package main

import (
	"os"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestEnvUtils(t *testing.T) {
	RegisterFailHandler(Fail) // Tells Gomega how to signal test failures to Ginkgo
	RunSpecs(t, "Environment Variable Helper Functions Suite")
}

var _ = Describe("Environment Variable Helper Functions", func() {

	Describe("getEnvAsInt", func() {
		tests := []struct {
			name       string
			envVarName string
			envVarVal  string
			defaultVal int
			expected   int
		}{
			{
				name:       "when env var exists and is a valid integer",
				envVarName: "TEST_INT_VAR_1",
				envVarVal:  "123",
				defaultVal: 0,
				expected:   123,
			},
			{
				name:       "when env var exists but is an invalid integer",
				envVarName: "TEST_INT_VAR_2",
				envVarVal:  "abc",
				defaultVal: 10,
				expected:   10, // Should return default
			},
			{
				name:       "when env var does not exist",
				envVarName: "TEST_INT_VAR_3",
				envVarVal:  "", // Signifies not set
				defaultVal: 20,
				expected:   20, // Should return default
			},
			{
				name:       "when env var is zero",
				envVarName: "TEST_INT_VAR_4",
				envVarVal:  "0",
				defaultVal: 5,
				expected:   0,
			},
		}

		for _, tt := range tests {
			tt := tt
			Context(tt.name, func() {
				BeforeEach(func() {
					if tt.envVarVal != "" {
						os.Setenv(tt.envVarName, tt.envVarVal)
					} else {
						os.Unsetenv(tt.envVarName)
					}
				})
				AfterEach(func() {
					os.Unsetenv(tt.envVarName)
				})

				It("should return the expected integer value", func() {
					result := getEnvAsInt(tt.envVarName, tt.defaultVal)
					Expect(result).To(Equal(tt.expected))
				})
			})
		}
	})

	Describe("getEnvAsFloat64", func() {
		tests := []struct {
			name       string
			envVarName string
			envVarVal  string
			defaultVal float64
			expected   float64
		}{
			{"when env var is a valid float", "TEST_FLOAT_VAR_1", "123.45", 0.0, 123.45},
			{"when env var is an invalid float", "TEST_FLOAT_VAR_2", "xyz", 10.5, 10.5},
			{"when env var does not exist", "TEST_FLOAT_VAR_3", "", 20.0, 20.0},
		}

		for _, tt := range tests {
			tt := tt
			Context(tt.name, func() {
				BeforeEach(func() {
					if tt.envVarVal != "" {
						os.Setenv(tt.envVarName, tt.envVarVal)
					} else {
						os.Unsetenv(tt.envVarName)
					}
				})

				AfterEach(func() {
					os.Unsetenv(tt.envVarName)
				})

				It("should return the expected float64 value", func() {
					result := getEnvAsFloat64(tt.envVarName, tt.defaultVal)
					Expect(result).To(Equal(tt.expected))
				})
			})
		}
	})

	Describe("getEnvAsStr", func() {
		tests := []struct {
			name       string
			envVarName string
			envVarVal  string // Use "" to signify env var is NOT set
			defaultVal string
			expected   string
		}{
			{"when env var is a valid string", "TEST_STR_VAR_1", "hello", "default", "hello"},
			{"when env var is an empty string", "TEST_STR_VAR_2", "", "default", ""},           // Note: os.Getenv returns "" for empty or not set
			{"when env var does not exist", "TEST_STR_VAR_3", "NOT_SET", "default", "default"}, // Use a marker like "NOT_SET"
		}

		for _, tt := range tests {
			tt := tt
			Context(tt.name, func() {
				BeforeEach(func() {
					if tt.envVarVal == "NOT_SET" {
						os.Unsetenv(tt.envVarName)
					} else {
						os.Setenv(tt.envVarName, tt.envVarVal)
					}
				})

				AfterEach(func() {
					os.Unsetenv(tt.envVarName)
				})

				It("should return the expected string value", func() {
					result := getEnvAsStr(tt.envVarName, tt.defaultVal)
					Expect(result).To(Equal(tt.expected))
				})
			})
		}
	})

	Describe("getEnvAsBool", func() {
		tests := []struct {
			name       string
			envVarName string
			envVarVal  string
			defaultVal bool
			expected   bool
		}{
			{"when env var is 'true'", "TEST_BOOL_VAR_1", "true", false, true},
			{"when env var is 'false'", "TEST_BOOL_VAR_2", "false", true, false},
			{"when env var is an invalid boolean string", "TEST_BOOL_VAR_3", "notbool", false, false},
			{"when env var does not exist", "TEST_BOOL_VAR_4", "NOT_SET", true, true},
		}

		for _, tt := range tests {
			tt := tt
			Context(tt.name, func() {
				BeforeEach(func() {
					if tt.envVarVal == "NOT_SET" {
						os.Unsetenv(tt.envVarName)
					} else {
						os.Setenv(tt.envVarName, tt.envVarVal)
					}
				})

				AfterEach(func() {
					os.Unsetenv(tt.envVarName)
				})

				It("should return the expected boolean value", func() {
					result := getEnvAsBool(tt.envVarName, tt.defaultVal)
					Expect(result).To(Equal(tt.expected))
				})
			})
		}
	})
})
