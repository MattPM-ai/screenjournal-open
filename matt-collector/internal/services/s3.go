package services

import (
	"context"
	"fmt"
	"io"
	"time"

	"matt-collector/internal/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Service handles S3 file uploads
type S3Service struct {
	client   *s3.Client
	bucket   string
	region   string
	endpoint string // Custom endpoint for MinIO/S3-compatible services
}

// NewS3Service creates a new S3 service
func NewS3Service(cfg *config.S3Config) (*S3Service, error) {
	ctx := context.Background()

	// Create custom AWS config with credentials
	var awsCfg aws.Config
	var err error

	if cfg.Endpoint != "" {
		// Custom endpoint (for MinIO or other S3-compatible services)
		awsCfg, err = awsconfig.LoadDefaultConfig(ctx,
			awsconfig.WithRegion(cfg.Region),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKeyID,
				cfg.SecretAccessKey,
				"",
			)),
		)
	} else {
		// Standard AWS S3
		awsCfg, err = awsconfig.LoadDefaultConfig(ctx,
			awsconfig.WithRegion(cfg.Region),
			awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKeyID,
				cfg.SecretAccessKey,
				"",
			)),
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client
	var client *s3.Client
	if cfg.Endpoint != "" {
		client = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
			o.UsePathStyle = true // Required for MinIO
		})
	} else {
		client = s3.NewFromConfig(awsCfg)
	}

	return &S3Service{
		client:   client,
		bucket:   cfg.Bucket,
		region:   cfg.Region,
		endpoint: cfg.Endpoint,
	}, nil
}

// UploadScreenshot uploads a screenshot to S3
// Returns the S3 key (path) of the uploaded file
// monitorIdx differentiates screenshots from multiple monitors captured at the same timestamp
func (s *S3Service) UploadScreenshot(ctx context.Context, org, user string, timestamp time.Time, monitorIdx int, reader io.Reader, contentType string) (string, error) {
	// Generate S3 key: <org>/<user>/<timestamp>_monitor<idx>.png
	key := fmt.Sprintf("%s/%s/%d_monitor%d.png", org, user, timestamp.Unix(), monitorIdx)

	// Upload to S3
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	return key, nil
}

// GetFileURL returns the full HTTPS URL for a given key
func (s *S3Service) GetFileURL(key string) string {
	if s.endpoint != "" {
		// Custom endpoint (MinIO or S3-compatible service)
		// Format: <endpoint>/<bucket>/<key>
		return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	}
	// AWS S3 standard URL format
	// Format: https://<bucket>.s3.<region>.amazonaws.com/<key>
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, key)
}

// GetScreenshotKey generates the S3 key for a screenshot given org, user, timestamp, and monitor index
func (s *S3Service) GetScreenshotKey(org, user string, timestamp int64, monitorIdx int) string {
	return fmt.Sprintf("%s/%s/%d_monitor%d.png", org, user, timestamp, monitorIdx)
}

// GetObject retrieves an object from S3
// Returns the object body, content type, and any error
func (s *S3Service) GetObject(ctx context.Context, key string) (io.ReadCloser, string, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to get object from S3: %w", err)
	}

	contentType := "application/octet-stream"
	if output.ContentType != nil {
		contentType = *output.ContentType
	}

	return output.Body, contentType, nil
}
