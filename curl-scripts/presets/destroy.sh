#!/bin/bash

curl --include --request DELETE http://localhost:8000/presets/${ID} \
  --header "Authorization: Bearer ${TOKEN}"
