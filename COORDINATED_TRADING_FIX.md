# Coordinated Trading Duplicate Detection Fix

## Issue Summary

The coordinated trading detection system was creating duplicate entries for the same token in consecutive time windows. This happened due to inconsistent time window logic in three different places:

1. **Webhook handler** in `src/index.ts` (real-time detection)
2. **Background scanner** in `src/index.ts` (periodic scanning)  
3. **Manual scan script** `scripts/coordScan.ts` (manual execution)

## Root Cause

### Original Problematic Logic
```typescript
const now = new Date();
const start = new Date(now.getTime() - WINDOW_MS);
const windowStart = floorToWindowStart(start);  // ❌ WRONG
const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);
```

**Problems:**
1. **Misaligned Windows**: Using `floorToWindowStart(start)` where `start = now - WINDOW_MS` created inconsistent window boundaries
2. **Rolling vs Fixed Windows**: The logic used rolling time ranges to find transfers but mapped them to fixed time windows
3. **Multiple Detections**: The same token activity could span multiple detection runs, creating duplicate entries

### Example of the Problem
- **Run 1 at 10:03**: Detects activity from 09:58-10:03 → creates window 09:55-10:00
- **Run 2 at 10:08**: Detects activity from 10:03-10:08 → creates window 10:00-10:05 
- **Result**: Same token gets detected in both windows if its activity spans 10:00-10:03

## Solution

### Fixed Logic
```typescript
const now = new Date();
const currentWindowStart = floorToWindowStart(now);           // ✅ Align to current window
const windowStart = new Date(currentWindowStart.getTime() - WINDOW_MS);  // ✅ Previous complete window
const windowEnd = currentWindowStart;                         // ✅ End at current window start

// Additional duplicate prevention
const existingWindowCheck = await prisma.coordinatedTrade.findFirst({
  where: { windowStart },
  select: { id: true },
});

if (existingWindowCheck) {
  console.log('Window already processed, skipping');
  return;
}
```

### Key Improvements

1. **Fixed Window Boundaries**: Always use complete, non-overlapping 5-minute windows
2. **Duplicate Prevention**: Check if a window has already been processed before scanning
3. **Consistent Logic**: Same time window calculation in all three detection points
4. **Better Logging**: Added debug logs to track window processing

## Files Modified

1. **`scripts/coordScan.ts`**: Fixed standalone scan script
2. **`src/index.ts`**: Fixed webhook handler and background scanner
3. **Created utilities**:
   - `scripts/dedupeCoorded.ts`: Clean up existing duplicates
   - `scripts/analyzeCoordTiming.ts`: Analyze timing overlaps
   - `scripts/testCoordWindow.ts`: Test the fix

## Verification

The fix was tested with a comprehensive test script that:
1. Creates coordinated buy activity in a specific time window
2. Runs the detection logic twice
3. Verifies no duplicates are created
4. Confirms only one coordinated trade entry exists

**Test Result**: ✅ PASSED - No duplicates created

## Prevention

The new logic ensures:
- **Idempotent Operations**: Running detection multiple times on the same window produces the same result
- **Non-overlapping Windows**: Each 5-minute window is processed exactly once
- **Clear Boundaries**: Time windows are always aligned to exact 5-minute intervals (e.g., 10:00-10:05, 10:05-10:10)

## Usage

To clean up any existing duplicates:
```bash
npx tsx scripts/dedupeCoorded.ts
```

To analyze current timing issues:
```bash
npx tsx scripts/analyzeCoordTiming.ts
```

To test the fix:
```bash
npx tsx scripts/testCoordWindow.ts
```
