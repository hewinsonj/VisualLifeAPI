#!/bin/bash

curl --include --request POST http://localhost:8000/presets \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer ${TOKEN}" \
  --data '{
    "preset": {
      "name": "'"${NAME}"'",
      "patchOrder": ["chromaPulse", "duotone"],
      "params": {
        "chromaPulse": { "chromaPulseStrength": 0.8, "chromaPulseSpeed": 1.2 },
        "duotone": { "duotoneEnabled": true }
      },
      "isPublic": false
    }
  }'
