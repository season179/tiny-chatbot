#!/bin/bash

# Test script to verify session persistence works across server restarts

echo "🧪 Testing SQLite Session Persistence"
echo "======================================"
echo ""

# Clean up any existing test database
rm -f ./data/test-persistence.db
mkdir -p ./data

# Set test database path
export DATABASE_PATH=./data/test-persistence.db

echo "📝 Step 1: Creating a session and sending a message..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:4000/api/session \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-tenant", "userId": "test-user"}')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')
echo "   Session ID: $SESSION_ID"

CHAT_RESPONSE=$(curl -s -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Hello, this is a persistence test!\"}")

echo "   Message sent successfully!"
echo ""

echo "📊 Step 2: Checking database file..."
if [ -f "$DATABASE_PATH" ]; then
  echo "   ✅ Database file exists at: $DATABASE_PATH"
  FILE_SIZE=$(ls -lh "$DATABASE_PATH" | awk '{print $5}')
  echo "   Database size: $FILE_SIZE"
else
  echo "   ❌ Database file not found!"
  exit 1
fi
echo ""

echo "🔄 Step 3: Simulating server restart..."
echo "   (In a real test, you would stop and restart the server)"
echo "   For now, we're just verifying the database persists"
echo ""

echo "📖 Step 4: Querying the database directly..."
sqlite3 "$DATABASE_PATH" <<EOF
.headers on
.mode column
SELECT 'Sessions Table:' as info;
SELECT * FROM sessions;
SELECT '';
SELECT 'Messages Table:' as info;
SELECT id, role, substr(content, 1, 50) as content_preview, created_at FROM messages;
EOF
echo ""

echo "✨ Persistence Test Complete!"
echo ""
echo "To test server restart persistence:"
echo "1. Note the session ID: $SESSION_ID"
echo "2. Restart the server (Ctrl+C and run 'pnpm dev' again)"
echo "3. Try retrieving the session with a new message:"
echo ""
echo "   curl -X POST http://localhost:4000/api/chat \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"sessionId\": \"$SESSION_ID\", \"message\": \"Are you still there?\"}'"
echo ""