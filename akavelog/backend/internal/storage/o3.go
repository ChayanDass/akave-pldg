package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"path"
	"time"

	"github.com/akave-ai/akavelog/internal/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// O3Client uploads and downloads objects from Akave O3 (S3-compatible API).
type O3Client struct {
	client *s3.Client
	bucket string
}

// NewO3Client builds an S3-compatible client for the given O3 config.
// Returns nil if cfg is nil or endpoint/bucket are empty.
func NewO3Client(cfg *config.O3Config) (*O3Client, error) {
	if cfg == nil || cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, nil
	}
	region := cfg.Region
	if region == "" {
		region = "us-east-1"
	}
	creds := credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")
	client := s3.NewFromConfig(aws.Config{
		Region:      region,
		Credentials: aws.NewCredentialsCache(creds),
	}, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.Endpoint)
		o.UsePathStyle = true
	})
	return &O3Client{client: client, bucket: cfg.Bucket}, nil
}

// EnsureBucket creates the bucket if it does not exist (HeadBucket fails → CreateBucket).
func (c *O3Client) EnsureBucket(ctx context.Context) error {
	if c == nil {
		return nil
	}
	_, err := c.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(c.bucket)})
	if err == nil {
		return nil
	}
	// HeadBucket failed (404 NoSuchBucket or similar); try to create.
	_, createErr := c.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(c.bucket)})
	if createErr != nil {
		var apiErr smithy.APIError
		if errors.As(createErr, &apiErr) {
			switch apiErr.ErrorCode() {
			case "BucketAlreadyOwnedByYou", "BucketAlreadyExists":
				return nil
			}
		}
		return createErr
	}
	return nil
}

// PutObject uploads data to key. Key can include prefixes (e.g. "project/default/2024/01/15/batch-abc.json.gz").
func (c *O3Client) PutObject(ctx context.Context, key string, data []byte, contentType string) error {
	if c == nil {
		return fmt.Errorf("o3 client not configured")
	}
	_, err := c.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	return err
}

// KeyForBatch returns an object key for a log batch (e.g. logs/default/2024/02/17/abc123.json.gz).
func KeyForBatch(projectID string, batchID string, ext string) string {
	if projectID == "" {
		projectID = "default"
	}
	now := time.Now().UTC()
	return path.Join("logs", projectID, now.Format("2006/01/02"), batchID+ext)
}
