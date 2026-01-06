#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3001"
THERAPIST="therapist-004"
CLIENT="client-004"

create_session() {
  local start_time=$1
  curl -s -X POST "$BASE_URL/sessions" \
    -H "Content-Type: application/json" \
    -d "{\"therapistId\":\"$THERAPIST\",\"clientId\":\"$CLIENT\",\"startTime\":\"$start_time\"}" | jq -r '.data.sessionId'
}

add_entry() {
  local session_id=$1 speaker=$2 content=$3 timestamp=$4
  curl -s -X POST "$BASE_URL/sessions/$session_id/entries" \
    -H "Content-Type: application/json" \
    -d "{\"speaker\":\"$speaker\",\"content\":\"$content\",\"timestamp\":\"$timestamp\"}" >/dev/null
}

# Session 2 (Sleep, caffeine, rumination)
S2=$(create_session "2024-01-08T10:00:00Z")
add_entry "$S2" therapist "How has sleep been?" "2024-01-08T10:01:00Z"
add_entry "$S2" client "I’m waking at 3 AM worrying about deadlines; I drink 4 coffees daily." "2024-01-08T10:02:00Z"
add_entry "$S2" therapist "Reduce caffeine after noon; add a wind-down: dim lights, no screens, write worries." "2024-01-08T10:03:00Z"
add_entry "$S2" client "Cut to 2 coffees; used a 10-minute body scan; fell back asleep in 20 minutes." "2024-01-08T10:04:00Z"

# Session 3 (Exposure, safety behaviors)
S3=$(create_session "2024-01-15T10:00:00Z")
add_entry "$S3" therapist "Let’s plan exposure for your social anxiety." "2024-01-15T10:01:00Z"
add_entry "$S3" client "I avoid team lunches; I sit in back to avoid being called on." "2024-01-15T10:02:00Z"
add_entry "$S3" therapist "These are safety behaviors. Try graded exposure: join a small lunch, speak once." "2024-01-15T10:03:00Z"
add_entry "$S3" client "I joined a 4-person lunch, spoke twice; anxiety was 6/10, then 3/10." "2024-01-15T10:04:00Z"

# Session 4 (Cognitive restructuring, catastrophizing)
S4=$(create_session "2024-01-22T10:00:00Z")
add_entry "$S4" therapist "What thoughts come before panic?" "2024-01-22T10:01:00Z"
add_entry "$S4" client "I’ll humiliate myself; they’ll think I’m incompetent." "2024-01-22T10:02:00Z"
add_entry "$S4" therapist "Let’s challenge that: evidence for/against; alternative thoughts." "2024-01-22T10:03:00Z"
add_entry "$S4" client "After challenging, fear dropped from 9/10 to 5/10." "2024-01-22T10:04:00Z"

# Session 5 (Relapse plan, metrics)
S5=$(create_session "2024-01-29T10:00:00Z")
add_entry "$S5" therapist "Let’s set metrics: pre-meeting anxiety, sleep quality, exposure attempts." "2024-01-29T10:01:00Z"
add_entry "$S5" client "Baseline was 8/10 pre-meeting; now 4–5/10 after breathing + grounding." "2024-01-29T10:02:00Z"
add_entry "$S5" therapist "Relapse plan: if anxiety >7/10 for a week, increase practice, add extra check-in." "2024-01-29T10:03:00Z"

echo "Created sessions:"
echo "S2=$S2"
echo "S3=$S3"
echo "S4=$S4"
echo "S5=$S5"