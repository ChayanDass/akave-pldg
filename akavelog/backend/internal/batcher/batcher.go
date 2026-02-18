package batcher

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/akave-ai/akavelog/internal/model"
	"github.com/akave-ai/akavelog/internal/storage"
	"github.com/google/uuid"
)

// BatcherConfig configures batch size and flush interval.
type BatcherConfig struct {
	MaxBatchSize  int           // flush when batch has this many entries
	FlushInterval time.Duration // flush at least this often
}

// DefaultBatcherConfig returns defaults: 1000 entries or 30s.
func DefaultBatcherConfig() BatcherConfig {
	return BatcherConfig{
		MaxBatchSize:  1000,
		FlushInterval: 30 * time.Second,
	}
}

// Batcher implements inputs.InputBuffer. It validates log payloads, batches them,
// and on flush compresses and uploads to Akave O3 (if configured).
type Batcher struct {
	mu      sync.Mutex
	logs    []model.LogEntry
	config  BatcherConfig
	o3      *storage.O3Client
	stop    chan struct{}
	done    chan struct{}
	project string
	opts    *BatcherOpts
}

// BatcherOpts optional callbacks for demo UI (recent logs, upload status).
type BatcherOpts struct {
	OnLog   func(entry *model.LogEntry)     // called for each validated log
	OnFlush func(count int, key string)     // called after successful upload
}

// NewBatcher creates a batcher that flushes to O3 when configured. opts may be nil.
func NewBatcher(cfg BatcherConfig, o3 *storage.O3Client, projectID string, opts *BatcherOpts) *Batcher {
	if cfg.MaxBatchSize <= 0 {
		cfg.MaxBatchSize = DefaultBatcherConfig().MaxBatchSize
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = DefaultBatcherConfig().FlushInterval
	}
	b := &Batcher{
		logs:    make([]model.LogEntry, 0, cfg.MaxBatchSize),
		config:  cfg,
		o3:      o3,
		stop:    make(chan struct{}),
		done:    make(chan struct{}),
		project: projectID,
		opts:    opts,
	}
	go b.flushLoop()
	return b
}

// Insert implements inputs.InputBuffer. Parses and validates JSON; on success appends to batch and may flush.
func (b *Batcher) Insert(raw []byte) {
	entry, err := ValidateLog(raw)
	if err != nil {
		log.Printf("[batcher] invalid log: %v", err)
		return
	}
	b.mu.Lock()
	b.logs = append(b.logs, *entry)
	shouldFlush := len(b.logs) >= b.config.MaxBatchSize
	b.mu.Unlock()
	if b.opts != nil && b.opts.OnLog != nil {
		b.opts.OnLog(entry)
	}
	if shouldFlush {
		b.flush(context.Background())
	}
}

func (b *Batcher) flushLoop() {
	ticker := time.NewTicker(b.config.FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-b.stop:
			close(b.done)
			return
		case <-ticker.C:
			b.flush(context.Background())
		}
	}
}

// flush serializes the current batch, gzips it, uploads to O3, and clears the batch.
func (b *Batcher) flush(ctx context.Context) {
	b.mu.Lock()
	if len(b.logs) == 0 {
		b.mu.Unlock()
		return
	}
	snapshot := make([]model.LogEntry, len(b.logs))
	copy(snapshot, b.logs)
	b.logs = b.logs[:0]
	b.mu.Unlock()

	payload, err := json.Marshal(snapshot)
	if err != nil {
		log.Printf("[batcher] marshal batch: %v", err)
		return
	}
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(payload); err != nil {
		log.Printf("[batcher] gzip: %v", err)
		return
	}
	if err := w.Close(); err != nil {
		log.Printf("[batcher] gzip close: %v", err)
		return
	}
	compressed := buf.Bytes()

	if b.o3 != nil {
		key := storage.KeyForBatch(b.project, uuid.New().String(), ".json.gz")
		if err := b.o3.PutObject(ctx, key, compressed, "application/gzip"); err != nil {
			log.Printf("[batcher] upload to O3: %v", err)
			return
		}
		log.Printf("[batcher] uploaded %d logs to %s", len(snapshot), key)
		if b.opts != nil && b.opts.OnFlush != nil {
			b.opts.OnFlush(len(snapshot), key)
		}
	}
}

// Stop stops the flush loop and flushes any remaining logs.
func (b *Batcher) Stop() {
	close(b.stop)
	<-b.done
	b.flush(context.Background())
}
