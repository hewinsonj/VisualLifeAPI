#!/bin/bash

curl --include --request DELETE http://localhost:8000/sign-out \
  --header "Authorization: Bearer ${TOKEN}"
