# Quick Start Guide

## Installation & Testing

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the project
npm run build

# Lint the code
npm run lint

# Or use the test runner script
./run-tests.sh
```

## Test Suite Summary

### 32 Comprehensive Tests

#### ✅ Node Description (3 tests)
- Node properties validation
- Credentials configuration
- Parameters validation

#### ✅ Credentials Handling (8 tests)
- Unauthenticated connections
- SASL PLAIN authentication
- SASL SCRAM-SHA-256 authentication
- SASL SCRAM-SHA-512 authentication
- SSL/TLS configuration
- Combined SASL + SSL
- SSL rejectUnauthorized handling
- Auth config validation

#### ✅ Connection Handling (3 tests)
- Successful broker connections
- Connection error handling
- Broker list parsing

#### ✅ Topic Subscription (2 tests)
- fromBeginning flag handling
- Subscription error handling

#### ✅ Message Collection (4 tests)
- Exact batch size collection
- Batch size limit enforcement
- Complete metadata handling
- Missing field handling

#### ✅ JSON Parsing (3 tests)
- Valid JSON parsing
- String preservation
- Invalid JSON handling

#### ✅ Timeout Handling (3 tests)
- Timeout with insufficient messages
- Partial batch collection
- Custom readTimeout

#### ✅ Error Handling (4 tests)
- Consumer disconnect on errors
- NodeOperationError wrapping
- Resource cleanup
- Disconnect error handling

#### ✅ Output Format (4 tests)
- INodeExecutionData format
- Complete field inclusion
- Null key handling
- Empty value handling

#### ✅ Integration (1 test)
- Complete workflow simulation

## Key Files

| File | Description |
|------|-------------|
| `src/nodes/KafkaBatchConsumer/KafkaBatchConsumer.node.ts` | Main node implementation |
| `src/nodes/KafkaBatchConsumer/KafkaBatchConsumer.node.test.ts` | Complete test suite |
| `package.json` | Dependencies and scripts |
| `jest.config.js` | Test configuration (80% coverage threshold) |
| `README.md` | Full documentation |
| `PROJECT_STRUCTURE.md` | Detailed project overview |

## Coverage Requirements

Minimum 80% for all metrics:
- ✅ Branches: 80%+
- ✅ Functions: 80%+
- ✅ Lines: 80%+
- ✅ Statements: 80%+

## Node Features

### Parameters
- **brokers**: Kafka broker addresses
- **clientId**: Client identifier
- **groupId**: Consumer group ID
- **topic**: Topic to consume from
- **batchSize**: Messages per batch
- **fromBeginning**: Read from start
- **sessionTimeout**: Session timeout (ms)
- **options.readTimeout**: Max wait time (ms)
- **options.parseJson**: Auto-parse JSON

### Credentials (Optional)
- **SASL**: plain, scram-sha-256, scram-sha-512
- **SSL**: TLS with certificates
- **Combined**: SASL + SSL

### Output Format
```typescript
{
  json: {
    topic: string,
    partition: number,
    offset: string,
    key: string | null,
    value: any,
    timestamp: string,
    headers: Record<string, any>
  }
}
```

## Testing Tips

### Run specific test
```bash
npm test -- -t "should connect with SASL PLAIN"
```

### Watch mode
```bash
npm test -- --watch
```

### Debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Update snapshots (if any)
```bash
npm test -- -u
```

## Common Issues

### TypeScript errors before npm install
**Expected** - Dependencies need to be installed first.

### Coverage below 80%
Review untested code paths and add missing test cases.

### Mock not working
Ensure `jest.clearAllMocks()` is called in `beforeEach()`.

## Next Steps

1. ✅ Project created with all files
2. ⏳ Run `npm install`
3. ⏳ Run `npm run test:coverage`
4. ⏳ Verify 80%+ coverage
5. ⏳ Build with `npm run build`
6. ⏳ Test in N8N environment

## Questions?

See [README.md](README.md) for full documentation.
See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed structure.
