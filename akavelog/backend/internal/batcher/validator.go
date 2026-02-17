package batcher

import (
	"encoding/json"
	"fmt"

	"github.com/akave-ai/akavelog/internal/model"
)

// ValidateLog parses raw JSON and validates it as a log entry.
// Required: service, message. Level and timestamp default if missing.
func ValidateLog(raw []byte) (*model.LogEntry, error) {
	var e model.LogEntry
	if err := json.Unmarshal(raw, &e); err != nil {
		return nil, fmt.Errorf("invalid json: %w", err)
	}
	if e.Service == "" {
		return nil, fmt.Errorf("missing required field: service")
	}
	if e.Message == "" {
		return nil, fmt.Errorf("missing required field: message")
	}
	if e.Level == "" {
		e.Level = "info"
	}
	if e.Timestamp == "" {
		e.Timestamp = "0" // or set to now in caller if needed
	}
	if e.Tags == nil {
		e.Tags = make(map[string]string)
	}
	return &e, nil
}
