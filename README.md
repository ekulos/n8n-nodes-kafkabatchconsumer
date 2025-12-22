# N8N Kafka Batch Consumer Node

A custom N8N node for consuming Kafka messages in batches using KafkaJS.

## Features

- **Batch Message Consumption**: Collect a configurable number of messages before processing
- **Flexible Authentication**: Support for SASL (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512) and SSL/TLS
- **Comprehensive Error Handling**: Graceful error handling with proper resource cleanup
- **JSON Parsing**: Automatic JSON parsing with fallback to string
- **Timeout Management**: Configurable read timeout with partial batch support
- **N8N Integration**: Standard N8N node with credential support

## Installation

```bash
npm install
npm run build
```

## Configuration Parameters

### Required Parameters

- **Brokers**: Comma-separated list of Kafka broker addresses (e.g., `localhost:9092`)
- **Client ID**: Unique identifier for this Kafka client
- **Group ID**: Consumer group identifier
- **Topic**: Kafka topic to consume from
- **Batch Size**: Number of messages to consume in a batch

### Optional Parameters

- **From Beginning**: Whether to read from the beginning of the topic (default: `false`)
- **Session Timeout**: Session timeout in milliseconds (default: `30000`)

### Options

- **Read Timeout**: Maximum time to wait for messages in milliseconds (default: `60000`)
- **Parse JSON**: Whether to parse message values as JSON (default: `true`)

## Understanding Timeouts

The node uses two different timeout configurations that serve distinct purposes:

### Session Timeout (Kafka/Broker-side)

- **Purpose**: Manages the connection between the consumer and the Kafka broker
- **Function**: The broker uses this to determine if the consumer is still "alive" and part of the consumer group
- **Behavior**: 
  - The consumer must send heartbeats to the broker within this time
  - If the broker doesn't receive heartbeats for `sessionTimeout` milliseconds, it considers the consumer "dead" and triggers a rebalancing (reassigning partitions to other consumers in the group)
- **Typical values**: 6000-300000 ms (6-300 seconds). Minimum 6000ms enforced by the broker
- **Managed by**: Kafka broker and KafkaJS consumer (automatic background heartbeats)

### Read Timeout (Application-side)

- **Purpose**: Controls how long the n8n node waits to collect batch messages
- **Function**: Prevents the workflow from blocking indefinitely if insufficient messages arrive to complete the batch
- **Behavior**:
  - If `batchSize` messages arrive before the timeout → returns immediately
  - If the timeout expires first → returns collected messages (partial batch)
- **Typical values**: 60000 ms (60 seconds) by default, user-configurable
- **Managed by**: Application code (setTimeout in the execute method)

### Why Both Are Needed

- **Session Timeout alone**: The consumer would stay connected to the broker, but the n8n workflow would block forever if messages don't arrive
- **Read Timeout alone**: The workflow would complete correctly, but the broker might disconnect the consumer during long waits if heartbeats aren't maintained

**Best Practice**: Keep Session Timeout ≥ Read Timeout to avoid broker disconnections while waiting for messages. However, KafkaJS sends heartbeats automatically in the background, so the consumer stays alive even during longer Read Timeouts.

## Credentials

The node supports optional Kafka credentials with the following features:

### SASL Authentication

- **PLAIN**: Simple username/password authentication
- **SCRAM-SHA-256**: Salted Challenge Response Authentication Mechanism with SHA-256
- **SCRAM-SHA-512**: Salted Challenge Response Authentication Mechanism with SHA-512

### SSL/TLS Configuration

- **Reject Unauthorized**: Whether to reject unauthorized SSL certificates
- **CA Certificate**: Certificate Authority certificate
- **Client Certificate**: Client certificate for mutual TLS
- **Client Key**: Client private key for mutual TLS

## Usage Example

1. Add the "Kafka Batch Consumer" node to your workflow
2. Configure the broker addresses and topic
3. Set the desired batch size
4. Optionally configure credentials for authentication
5. Run the workflow to consume messages

## Output Format

Each message is returned as an `INodeExecutionData` object with the following structure:

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

## Testing

The project includes comprehensive Jest tests covering:

- Credential handling (SASL, SSL, combinations)
- Connection management
- Message collection and batching
- JSON parsing
- Timeout handling
- Error handling
- Output format validation

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Coverage target: 80% minimum

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm test
```

## License

MIT
