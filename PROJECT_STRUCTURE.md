# N8N Kafka Batch Consumer - Project Structure

## Overview
This project implements a custom N8N node for consuming Kafka messages in batches with comprehensive Jest test coverage.

## Project Structure

```
n8n-nodes-kafkabatchconsumer/
├── src/
│   ├── nodes/
│   │   └── KafkaBatchConsumer/
│   │       ├── KafkaBatchConsumer.node.ts          # Main node implementation
│   │       ├── KafkaBatchConsumer.node.test.ts     # Comprehensive Jest tests
│   │       └── kafka.svg                           # Node icon
│   └── index.ts                                    # Package entry point
├── package.json                                     # Dependencies and scripts
├── tsconfig.json                                   # TypeScript configuration
├── jest.config.js                                  # Jest test configuration
├── .eslintrc.js                                    # ESLint configuration
├── .gitignore                                      # Git ignore rules
├── README.md                                       # Project documentation
└── run-tests.sh                                    # Test runner script
```

## Key Features Implemented

### Node Implementation (KafkaBatchConsumer.node.ts)

✅ **KafkaJS Integration**
- Consumer with configurable batch size
- Connection management with proper cleanup
- Subscription handling with fromBeginning option

✅ **N8N Integration**
- Standard INodeType implementation
- Input/output configuration
- Node parameter definitions
- Credential integration

✅ **Parameters**
- brokers: Comma-separated broker addresses
- clientId: Unique client identifier
- groupId: Consumer group ID
- topic: Kafka topic name
- batchSize: Number of messages per batch
- fromBeginning: Start position flag
- sessionTimeout: Session timeout in milliseconds
- options: Additional options (readTimeout, parseJson)

✅ **Credentials Support**
- Optional kafka credentials
- SASL authentication (plain, scram-sha-256, scram-sha-512)
- SSL/TLS configuration
- Support for unauthenticated connections

✅ **Message Processing**
- Batch collection with size limit
- JSON parsing with fallback
- Timeout handling
- Complete message metadata preservation

✅ **Error Handling**
- NodeOperationError wrapping
- Resource cleanup in finally blocks
- Graceful disconnect on errors

### Test Suite (KafkaBatchConsumer.node.test.ts)

✅ **Credentials Tests** (8 tests)
- Connect without credentials
- SASL PLAIN authentication
- SASL SCRAM-SHA-256 authentication
- SASL SCRAM-SHA-512 authentication
- SSL/TLS configuration
- Combined SASL and SSL
- SSL with rejectUnauthorized false
- Correct auth config passing

✅ **Connection Tests** (3 tests)
- Successful connection
- Connection error handling
- Comma-separated brokers parsing

✅ **Subscription Tests** (2 tests)
- Subscribe with fromBeginning flag
- Subscription error handling

✅ **Message Collection Tests** (4 tests)
- Exact batchSize collection
- Stop when batchSize reached
- All metadata fields handling
- Missing optional fields handling

✅ **JSON Parsing Tests** (3 tests)
- Valid JSON parsing when parseJson=true
- String preservation when parseJson=false
- Invalid JSON handling

✅ **Timeout Tests** (3 tests)
- Timeout with insufficient messages
- Partial batch on timeout
- readTimeout option respect

✅ **Error Handling Tests** (4 tests)
- Consumer disconnect on error
- NodeOperationError throwing
- Resource cleanup in finally block
- Graceful disconnect error handling

✅ **Output Format Tests** (4 tests)
- INodeExecutionData array return
- Complete field inclusion
- Null key handling
- Empty value handling

✅ **Integration Tests** (1 test)
- Complete workflow with authentication

**Total: 32 comprehensive test cases**

## Configuration Files

### package.json
- Dependencies: kafkajs, n8n-workflow
- Dev dependencies: Jest, TypeScript, ESLint, ts-jest
- Scripts: build, test, test:coverage, lint
- N8N node registration

### tsconfig.json
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps and declarations

### jest.config.js
- Preset: ts-jest
- Environment: node
- Coverage threshold: 80% (all metrics)
- Coverage directory: ./coverage

### .eslintrc.js
- TypeScript ESLint parser
- Recommended rules
- TypeScript plugin configuration

## Running the Project

### Install Dependencies
```bash
npm install
```

### Build
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Test Script
```bash
chmod +x run-tests.sh
./run-tests.sh
```

## Test Coverage Target

**Minimum 80% coverage for:**
- Branches
- Functions
- Lines
- Statements

## Mock Strategy

The test suite uses comprehensive mocking:
- **kafkajs**: Mocked Kafka and Consumer classes
- **n8n-workflow**: Mocked IExecuteFunctions
- **Consumer methods**: connect, subscribe, run, disconnect
- **Credentials**: Various authentication scenarios

## Test Assertions

Examples of assertions used:
- `expect(Kafka).toHaveBeenCalledWith(expect.objectContaining({...}))`
- `expect(consumer.connect).toHaveBeenCalledTimes(1)`
- `expect(consumer.disconnect).toHaveBeenCalled()`
- `expect(result).toHaveLength(batchSize)`
- `expect(result[0].json).toHaveProperty('topic')`

## Language

All code, comments, documentation, and test descriptions are in **English**.

## Implementation Highlights

### Credential Handling
The node properly integrates with N8N's credential system:
```typescript
credentials: [{
  name: 'kafka',
  required: false
}]
```

### Authentication Configuration
Builds proper Kafka config based on credentials:
```typescript
if (credentials.authentication) {
  kafkaConfig.sasl = {
    mechanism: credentials.authentication,
    username: credentials.username,
    password: credentials.password
  };
}
```

### SSL Configuration
Handles SSL with optional certificates:
```typescript
if (credentials.ssl !== undefined) {
  kafkaConfig.ssl = {
    rejectUnauthorized: credentials.ssl,
    ca: credentials.ca,
    cert: credentials.cert,
    key: credentials.key
  };
}
```

### Batch Collection
Implements proper batch collection with timeout:
```typescript
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    messages.push(messageData);
    if (messages.length >= batchSize) {
      clearTimeout(timeoutHandle);
      resolvePromise();
    }
  }
});
```

## Next Steps

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Run tests: `npm run test:coverage`
4. Verify 80%+ coverage in all metrics
5. Link to N8N for local testing (optional)

## Notes

- All TypeScript errors shown before npm install are expected (missing dependencies)
- The node follows N8N's standard patterns and conventions
- Tests cover all major code paths and edge cases
- Proper resource cleanup ensures no memory leaks
- Error handling provides clear feedback to users
