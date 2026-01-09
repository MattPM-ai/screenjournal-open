package validation

import (
	"encoding/json"
	"fmt"
	"matt-tracker-report/internal/models"
	"os"

	"github.com/xeipuuv/gojsonschema"
)

// LoadSchema loads a JSON schema from a file
func LoadSchema(schemaPath string) (*gojsonschema.Schema, error) {
	schemaLoader := gojsonschema.NewReferenceLoader("file://" + schemaPath)
	schema, err := gojsonschema.NewSchema(schemaLoader)
	if err != nil {
		return nil, fmt.Errorf("failed to load schema: %w", err)
	}
	return schema, nil
}

// ValidateReport validates a report JSON string against a schema
func ValidateReport(reportJSON string, schema *gojsonschema.Schema) error {
	documentLoader := gojsonschema.NewStringLoader(reportJSON)
	result, err := schema.Validate(documentLoader)
	if err != nil {
		return fmt.Errorf("failed to validate: %w", err)
	}

	if !result.Valid() {
		var errors []string
		for _, desc := range result.Errors() {
			errors = append(errors, desc.String())
		}
		return fmt.Errorf("validation failed: %v", errors)
	}

	return nil
}

// ValidateAndParseReport validates and unmarshals a report JSON string
func ValidateAndParseReport(reportJSON string, schemaPath string) (*models.Report, error) {
	// Load schema
	schemaData, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema file: %w", err)
	}

	schemaLoader := gojsonschema.NewBytesLoader(schemaData)
	schema, err := gojsonschema.NewSchema(schemaLoader)
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	// Validate
	if err := ValidateReport(reportJSON, schema); err != nil {
		return nil, err
	}

	// Parse
	var report models.Report
	if err := json.Unmarshal([]byte(reportJSON), &report); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return &report, nil
}

