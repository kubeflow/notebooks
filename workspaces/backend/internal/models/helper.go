package models

// GetOrDefaultWithRecovery safely retrieves the value, returning the default value if a panic occurs or the value is nil.
func GetOrDefaultWithRecovery[T any](value *T, defaultValue T) T {
	defer func() {
		if r := recover(); r != nil {
		}
	}()

	if value != nil {
		return *value
	}
	return defaultValue
}
