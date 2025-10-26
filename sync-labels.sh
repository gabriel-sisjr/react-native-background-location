#!/usr/bin/env bash
set -e

REPO="gabriel-sisjr/react-native-background-location"
LABELS_FILE="labels.json"

echo "🔄 Syncing labels for $REPO..."
echo

# Loop through each label in the JSON
jq -c '.[]' "$LABELS_FILE" | while read -r label; do
  name=$(echo "$label" | jq -r '.name')
  color=$(echo "$label" | jq -r '.color')
  description=$(echo "$label" | jq -r '.description')

  # Check if label already exists
  if gh label list -R "$REPO" --json name | jq -e ".[] | select(.name == \"$name\")" > /dev/null; then
    echo "✏️  Updating existing label: $name"
    gh label edit "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" \
      >/dev/null 2>&1 || true
  else
    echo "➕ Creating new label: $name"
    gh label create "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" \
      >/dev/null 2>&1 || true
  fi
done

echo
echo "✅ Done! All labels are synced."
