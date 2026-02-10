#!/bin/bash

# Script to add useNoIndex hook to all protected pages

pages=(
  "src/app/login/page.tsx"
  "src/app/signup/page.tsx"
  "src/app/analysis/page.tsx"
  "src/app/exam/[examId]/page.tsx"
  "src/app/shift/[shiftId]/page.tsx"
  "src/app/forgot-password/page.tsx"
  "src/app/reset-password/page.tsx"
  "src/app/admin-messages/page.tsx"
  "src/app/loading/[examId]/page.tsx"
  "src/app/dashboard/[examId]/page.tsx"
)

for page in "${pages[@]}"; do
  echo "Processing $page..."
  
  # Check if useNoIndex import already exists
  if ! grep -q "useNoIndex" "$page"; then
    # Add import after "use client"
    PERL_REGEX='s/^("use client")$/\1\nimport { useNoIndex } from "@\/hooks\/useNoIndex"/'
    
    # Use perl for in-place editing on macOS
    perl -i -pe "$PERL_REGEX" "$page"
    
    echo "  - Added useNoIndex import"
  else
    echo "  - useNoIndex import already exists"
  fi
done

echo "Done!"
