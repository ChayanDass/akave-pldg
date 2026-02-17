package model

// LogEntry is the validated structure for an ingested log.
// Ingest payloads should be JSON with these fields.
type LogEntry struct {
	Timestamp string            `json:"timestamp"`           // ISO8601 or Unix ms
	Service   string            `json:"service"`              // required
	Level     string            `json:"level"`                // e.g. debug, info, warn, error
	Message   string            `json:"message"`              // required
	Tags      map[string]string `json:"tags,omitempty"`       // optional key-value
	ProjectID string            `json:"project_id,omitempty"` // optional; for multi-tenant
}
