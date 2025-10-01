// Global test setup for all test files
// This file runs before any tests execute

// Set required environment variables for tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key-for-tests';
process.env.DATABASE_PATH = ':memory:';
// Disable shell sandbox for tests to avoid directory validation issues
process.env.SHELL_SANDBOX_ENABLED = 'false';
