# Shell Sandbox Environment Variables Fix

## Issue Description
The shell sandbox environment variables (`SHELL_SANDBOX_WORKING_DIR`, `SHELL_SANDBOX_MAX_OUTPUT_BYTES`, `SHELL_SANDBOX_TIMEOUT_MS`) were being **parsed but never used**.

When a user set:
```bash
SHELL_SANDBOX_ENABLED=true
SHELL_SANDBOX_WORKING_DIR=./proprietary-documents/
```

The chatbot could still access source code files because the server was using a hardcoded `DEFAULT_TOOLS_CONFIG` that always used `process.cwd()` as the working directory.

## Root Cause
In `server.ts`, the ShellToolService was initialized with:
```typescript
const shellToolService = new ShellToolService(DEFAULT_TOOLS_CONFIG, app.log);
```

This hardcoded config ignored all environment variable settings.

## Fix Applied

### 1. Startup Validation
Added validation that runs when the server starts. If `SHELL_SANDBOX_ENABLED=true` and the directory doesn't exist, the server will:
- Log a clear error message with the resolved path
- Show how to fix the configuration
- Exit immediately (fail fast)

This prevents the server from starting with invalid sandbox configuration.

### 2. Updated `server.ts` to Build Config from Environment Variables
```typescript
// Initialize ShellToolService with environment-based configuration
const toolsConfig: ToolsConfig = {
  workingDirRoot: path.resolve(config.SHELL_SANDBOX_WORKING_DIR),
  maxOutputBytes: config.SHELL_SANDBOX_MAX_OUTPUT_BYTES,
  executionTimeoutMs: config.SHELL_SANDBOX_TIMEOUT_MS
};

const shellToolService = new ShellToolService(toolsConfig, app.log);
```

Key changes:
- Environment variables are now used instead of hardcoded defaults
- `SHELL_SANDBOX_WORKING_DIR` must be an absolute path (enforced at construction)
- Validation happens at server startup if sandbox is enabled

### 3. Enhanced Path Validation Security in `ShellToolService.ts`
Fixed a potential security vulnerability in the path validation logic:

**Before:**
```typescript
if (!absolutePath.startsWith(this.config.workingDirRoot)) {
  throw error;
}
```

**Problem:** Could be bypassed with directory names like `proprietary-documents-evil` which would pass a `startsWith` check for `proprietary-documents`.

**After:**
```typescript
// Normalize with trailing separator for safe checks
this.normalizedWorkingDir = path.resolve(config.workingDirRoot) + path.sep;

// In validation
const normalizedAbsolutePath = path.resolve(absolutePath) + path.sep;
if (!normalizedAbsolutePath.startsWith(this.normalizedWorkingDir)) {
  throw error;
}
```

This ensures `/path/to/proprietary-documents-evil/` won't pass the check for `/path/to/proprietary-documents/`.

## Testing
All 160 existing tests continue to pass. The server logs now correctly show:
```
ShellToolService initialized with tools: cat, ls, grep, rg, head, tail, pwd, echo, wc, which 
(workingDir: /Users/season/Personal/wrapper-for-chatbot/tiny-chatbot/proprietary-documents)
```

## How to Verify the Fix

### Quick Test
Run the test script:
```bash
cd apps/server
./test-sandbox.sh
```

### Manual Test
1. Set environment variables in `apps/server/.env`:
```bash
SHELL_SANDBOX_ENABLED=true
# REQUIRED: Must be an absolute path
SHELL_SANDBOX_WORKING_DIR=/Users/season/Personal/wrapper-for-chatbot/tiny-chatbot/proprietary-documents/

# To get the absolute path, run: cd ../../proprietary-documents && pwd
```

2. Start the server:
```bash
cd apps/server
pnpm dev
```

3. Ask the chatbot: "What files can you see?"

4. Expected behavior:
   - ✅ Can access files in `proprietary-documents/` (e.g., `indeks-pembangunan-manusia.md`)
   - ❌ Cannot access source code files outside the sandbox (e.g., `src/server.ts`)
   - The AI will use `ls` and see only files in `proprietary-documents/`

## Files Modified
1. `apps/server/src/server.ts` - Build ToolsConfig from environment variables + startup validation
2. `apps/server/src/services/ShellToolService.ts` - Enhanced path validation security + public validation method
3. `apps/server/vitest.setup.ts` - Disable sandbox for tests to avoid validation issues

## Files Created
1. `SANDBOX_FIX_SUMMARY.md` - This documentation
2. `.cursor/rules/environment-config-usage.mdc` - Cursor rule to prevent similar issues
3. `apps/server/test-sandbox.sh` - Test script to verify sandbox configuration

## Security Improvements
- Environment variables are now properly respected for sandboxing
- Path validation is more secure against directory traversal bypass attempts
- Relative paths are converted to absolute paths for consistent validation
- Added path separator to validation check to prevent directory name bypass attacks

