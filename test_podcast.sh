#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
# set -e # Optional: uncomment for stricter error handling

# --- Configuration ---
BASE_URL="http://[::1]:3000"
# Generate a unique email for each run to avoid conflicts
USER_EMAIL="testuser$(date +%s)@example.com"
USER_PASSWORD="password123"
# URL for the podcast you want to create (replace with a real, accessible URL)
PODCAST_URL_TO_CREATE="https://en.wikipedia.org/wiki/Test_article_(aerospace)"

echo "--- Test Script Started ---"
echo "Base URL: $BASE_URL"
echo "Test User Email: $USER_EMAIL"
echo "Podcast URL: $PODCAST_URL_TO_CREATE"
echo ""

# --- Check for jq ---
if ! command -v jq &> /dev/null
then
    echo "Error: jq is not installed. Please install jq to parse JSON responses."
    echo "e.g., sudo apt install jq (Debian/Ubuntu) or brew install jq (macOS)"
    exit 1
fi

# --- 1. Create User ---
echo "1. Creating user..."
CREATE_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/user/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$USER_EMAIL\", \"password\": \"$USER_PASSWORD\"}")

# Basic check if the request seemed successful (doesn't guarantee user creation if API returns 2xx on error)
# A more robust check would parse the response code or body if the API provides clear success/error structures.
if [ -z "$CREATE_RESPONSE" ]; then
    echo "Error: Failed to get response from user creation endpoint."
    # If you uncommented 'set -e', curl failure would exit here anyway.
    # If not using 'set -e', explicitly exit:
    # exit 1
fi
# Assuming success if we got *any* response for simplicity here.
# You might want to add `jq` parsing here if the create endpoint returns the user ID or a success message.
echo "User creation request sent."
# echo "Response: $CREATE_RESPONSE" # Uncomment for debugging
echo ""

# --- 2. Login and Get Auth Token ---
echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$USER_EMAIL\", \"password\": \"$USER_PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo "Error: Failed to get access token. Login failed."
  echo "Login Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "Login successful. Token obtained."
# echo "Token: $ACCESS_TOKEN" # Uncomment for debugging
echo ""

# --- 3. Create Podcast ---
echo "3. Creating podcast..."
CREATE_PODCAST_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/podcasts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$PODCAST_URL_TO_CREATE\", \"deepDiveOption\": \"RETAIN\"}")

JOB_ID=$(echo "$CREATE_PODCAST_RESPONSE" | jq -r '.jobId')

# Check if JOB_ID is a number
if ! [[ "$JOB_ID" =~ ^[0-9]+$ ]]; then
    echo "Error: Failed to create podcast or extract job ID."
    echo "Create Podcast Response: $CREATE_PODCAST_RESPONSE"
    exit 1
fi
echo "Podcast creation request sent. Job ID: $JOB_ID"
echo ""

# --- 4. Poll Podcast Status ---
echo "4. Polling podcast status for Job ID $JOB_ID (10 times, 1 second interval)..."
for i in {1..10}
do
  echo -n "Attempt $i: " # -n prevents newline
  STATUS_RESPONSE=$(curl -s -X GET \
    "$BASE_URL/podcasts/jobs/$JOB_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  # Check if curl command succeeded before trying to parse
  if [ $? -ne 0 ]; then
      echo "Error fetching status (curl failed)."
      sleep 1
      continue # Try next iteration
  fi

  PODCAST_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  PODCAST_ID=$(echo "$STATUS_RESPONSE" | jq -r '.podcastId')
  ERROR_MESSAGE=$(echo "$STATUS_RESPONSE" | jq -r '.errorMessage') # Assuming your API might return this on failure

  if [ -z "$PODCAST_STATUS" ] || [ "$PODCAST_STATUS" == "null" ]; then
      echo "Error fetching status (invalid response)."
      echo "Status Response: $STATUS_RESPONSE"
  else
      echo "Status = $PODCAST_STATUS"
      # Optional: Check for terminal states
      if [ "$PODCAST_STATUS" == "completed" ]; then
          echo "Podcast processing completed. Podcast ID: $PODCAST_ID"
          break # Exit loop early
      elif [ "$PODCAST_STATUS" == "failed" ]; then
          echo "Podcast processing failed. Error: ${ERROR_MESSAGE:-Unknown error}"
          break # Exit loop early
      fi
  fi

  sleep 1
done

echo ""
echo "--- Test Script Finished ---" 

# Output the command to check the status again
echo "To check the podcast status again, use the following command:"
echo "curl -s -X GET \"$BASE_URL/podcasts/jobs/$JOB_ID\" -H \"Authorization: Bearer $ACCESS_TOKEN\" | jq" 
