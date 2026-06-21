#!/bin/bash

curl --include --request GET http://localhost:8000/presets \
  --header "Authorization: Bearer ${TOKEN}"
