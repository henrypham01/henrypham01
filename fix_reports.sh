#!/bin/bash

# Fix reports/page.tsx
sed -i '' 's/from "lucid.*e-react"/from "lucide-react"/g' "src/app/[locale]/(app)/reports/page.tsx"
sed -i '' 's/lg:grid-col.*s-5/lg:grid-cols-5/g' "src/app/[locale]/(app)/reports/page.tsx"

# Fix revenue/page.tsx
sed -i '' 's/quantity: num.*/quantity: number };/' "src/app/[locale]/(app)/reports/revenue/page.tsx"
sed -i '' 's/"yyyy-.*MM-dd"/"yyyy-MM-dd"/g' "src/app/[locale]/(app)/reports/revenue/page.tsx"
sed -i '' 's/TabsTrig.*ger>/TabsTrigger>/g' "src/app/[locale]/(app)/reports/revenue/page.tsx"
sed -i '' 's/TabsTrigge.*r>/TabsTrigger>/g' "src/app/[locale]/(app)/reports/revenue/page.tsx"

# Fix profit/page.tsx  
sed -i '' 's/"yyyy-MM-dd".*));/"yyyy-MM-dd"));/g' "src/app/[locale]/(app)/reports/profit/page.tsx"
sed -i '' 's/te.*xt-green-600/text-green-600/g' "src/app/[locale]/(app)/reports/profit/page.tsx"
sed -i '' 's/<.*\/p>/<\/p>/g' "src/app/[locale]/(app)/reports/profit/page.tsx"
sed -i '' 's/text-destruct.*ive/text-destructive/g' "src/app/[locale]/(app)/reports/profit/page.tsx"

# Fix inventory/page.tsx
sed -i '' 's/bg-destructive\/5.*/bg-destructive\/5 p-4 mb-6">/' "src/app/[locale]/(app)/reports/inventory/page.tsx"
sed -i '' 's/text-destructive font-bold" : .*/text-destructive font-bold" : "">/' "src/app/[locale]/(app)/reports/inventory/page.tsx"

echo "Fixes applied!"
