#!/bin/bash

# Wallet Tracker - Duplicate Detection Health Check
# Run this script to verify the integrity of your transfer data

echo "========================================"
echo "Wallet Tracker - Duplicate Health Check"
echo "========================================"
echo ""

# Check for true duplicates (should always be 0)
echo "1. Checking for TRUE duplicates..."
npx tsx scripts/findTrueDuplicates.ts

echo ""
echo "========================================"
echo ""

# Show statistics
echo "2. Database Statistics..."
npx tsx scripts/checkDuplicates.ts

echo ""
echo "========================================"
echo ""
echo "Health check complete!"
echo ""
echo "Expected results:"
echo "  ✅ No true duplicates found"
echo "  ✅ No duplicates by composite key"
echo "  ℹ️  Multi-token transactions are NORMAL"
echo ""
