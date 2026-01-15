#!/bin/bash
# ============================================================================
# UPLOAD TURBO TEST DATA TO INFLUXDB 3 USING CURL
# ============================================================================
# 
# PURPOSE: Upload all test data line protocol files to InfluxDB 3 using curl
#          (Alternative to influxdb3 CLI for servers using Token auth)
# 
# USAGE:
#   ./upload_with_curl.sh <database> <token> [influxdb-url]
# 
# EXAMPLES:
#   ./upload_with_curl.sh screenjournal-metrics-dev "your-token-here" "http://195.74.52.54:8181"
# 
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

DATABASE="${1}"
TOKEN="${2}"
INFLUXDB_URL="${3:-http://localhost:8181}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../influxdb"

# ============================================================================
# VALIDATION
# ============================================================================

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}TURBO TEST DATA UPLOAD TO INFLUXDB 3 (CURL)${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check arguments
if [ -z "$DATABASE" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}ERROR: Missing required arguments${NC}"
    echo ""
    echo "Usage: $0 <database> <token> [influxdb-url]"
    echo ""
    exit 1
fi

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${RED}ERROR: Data directory not found: $DATA_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration:${NC}"
echo "  Database:     $DATABASE"
echo "  InfluxDB URL: $INFLUXDB_URL"
echo "  Data Dir:     $DATA_DIR"
echo ""

# ============================================================================
# TEST CONNECTION
# ============================================================================

echo -e "${YELLOW}Testing connection...${NC}"

# Test write with a simple line
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${DATABASE}" \
  -H "Authorization: Token ${TOKEN}" \
  -H "Content-Type: text/plain" \
  --data "test_connection value=1")

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Connection successful (HTTP $HTTP_CODE)${NC}"
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}✗ Authentication failed (HTTP 401)${NC}"
    echo ""
    echo "Possible issues:"
    echo "  - Invalid token"
    echo "  - Token doesn't have write permissions"
    echo "  - Database doesn't exist"
    echo ""
    echo "Try creating the database first or check your token."
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}✗ Database not found (HTTP 404)${NC}"
    echo ""
    echo "Create the database first:"
    echo "  curl -X POST '${INFLUXDB_URL}/api/v3/configure/database' \\"
    echo "    -H 'Authorization: Token ${TOKEN}' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"name\":\"${DATABASE}\"}'"
    echo ""
    exit 1
else
    echo -e "${YELLOW}⚠ Unexpected response: HTTP $HTTP_CODE${NC}"
    echo "Continuing anyway..."
fi

echo ""

# ============================================================================
# UPLOAD DATA
# ============================================================================

echo -e "${YELLOW}Uploading data files...${NC}"
echo ""

FILES=("app_usage.lp" "afk_status.lp" "window_activity.lp" "daily_metrics.lp")
UPLOAD_COUNT=0
SUCCESS_COUNT=0
FAILED_COUNT=0

for FILE in "${FILES[@]}"; do
    FILE_PATH="$DATA_DIR/$FILE"
    
    if [ ! -f "$FILE_PATH" ]; then
        echo -e "${RED}✗ File not found: $FILE${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        continue
    fi
    
    # Count records in this file (excluding comments and empty lines)
    RECORD_COUNT=$(grep -v '^#' "$FILE_PATH" | grep -v '^$' | wc -l | tr -d ' ')
    
    echo -e "${YELLOW}Uploading: ${FILE}${NC} (${RECORD_COUNT} records)"
    
    # Upload to InfluxDB using curl
    # Remove comment lines before sending
    HTTP_CODE=$(grep -v '^#' "$FILE_PATH" | grep -v '^$' | \
        curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${DATABASE}" \
        -H "Authorization: Token ${TOKEN}" \
        -H "Content-Type: text/plain" \
        --data-binary @-)
    
    if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Successfully uploaded: ${FILE} (HTTP $HTTP_CODE)${NC}"
        UPLOAD_COUNT=$((UPLOAD_COUNT + RECORD_COUNT))
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}✗ Failed to upload: ${FILE} (HTTP $HTTP_CODE)${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        
        # Show error details for first failure
        if [ $FAILED_COUNT -eq 1 ]; then
            echo -e "${YELLOW}  Getting error details...${NC}"
            ERROR_MSG=$(grep -v '^#' "$FILE_PATH" | grep -v '^$' | head -5 | \
                curl -s -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${DATABASE}" \
                -H "Authorization: Token ${TOKEN}" \
                -H "Content-Type: text/plain" \
                --data-binary @-)
            if [ -n "$ERROR_MSG" ]; then
                echo -e "${YELLOW}  Error: $ERROR_MSG${NC}"
            fi
        fi
    fi
    
    echo ""
done

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}============================================================================${NC}"
if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ UPLOAD COMPLETE${NC}"
else
    echo -e "${YELLOW}⚠ UPLOAD COMPLETED WITH ERRORS${NC}"
fi
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo "Summary:"
echo "  Files uploaded:  $SUCCESS_COUNT / ${#FILES[@]}"
echo "  Records written: $UPLOAD_COUNT"
echo "  Failed:          $FAILED_COUNT"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo "Next steps:"
    echo "  1. Verify data with: ./verify_with_curl.sh $DATABASE <token> $INFLUXDB_URL"
    echo "  2. Query your data using the InfluxDB API or SQL"
else
    echo "Troubleshooting:"
    echo "  - Check if database exists"
    echo "  - Verify token has write permissions"
    echo "  - Check InfluxDB logs for details"
fi
echo ""

exit $FAILED_COUNT

