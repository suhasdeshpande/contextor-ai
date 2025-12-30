# Test Coverage

## Unit Tests (55 tests)

Located in `*.test.ts` files:

- **`utils.test.ts`** (10 tests) - Utility functions
  - `stringToContentV2` conversion
  - `getMessageText` extraction
  - `estimateTokensDefault` token counting
  - `shouldKeepMessage` retention logic

- **`validation.test.ts`** (16 tests) - Validation logic
  - `validateMessages` type checking
  - `getValidationError` error messages
  - Edge cases (empty arrays, invalid types, missing fields)

- **`index.test.ts`** (29 tests) - Core functionality
  - Processor creation
  - All 4 strategies (filter, compact, summarize, offload)
  - Lifecycle hooks (beforeProcess, afterModify, shouldRunStrategy)
  - Error handling (onError, onValidationError)
  - Token counter integration
  - Validation system
  - Edge cases and rollback scenarios

## Integration Tests (7 tests)

Located in `integration.test.ts` - **Validates README claims**:

### ✅ Claim: Token Reduction
- Validates 20%+ token reduction in long conversations
- Proves context manager keeps tokens within limits

### ✅ Claim: Prevents Token Limit Failures
- Validates graceful handling when context exceeds limits
- Proves messages are reduced without errors

### ✅ Claim: Strategy Effectiveness
- **Filtering**: 20-30% token reduction ✅
- **Compaction**: 40-60% token reduction ✅
- **Summarization**: 70-85% token reduction ✅
- **Offloading**: 80-95% token reduction ✅

### ✅ Claim: Multi-Step Reliability
- Validates 50+ steps without failures
- Proves context stays manageable throughout

## Running Tests

```bash
# All tests (unit + integration)
bun test

# Unit tests only
bun test --exclude integration.test.ts

# Integration tests only
bun test integration.test.ts

# With coverage
bun test --coverage
```

## Test Results

All tests pass ✅:
- **62 total tests** (55 unit + 7 integration)
- **0 failures**
- **100% of README claims validated**

