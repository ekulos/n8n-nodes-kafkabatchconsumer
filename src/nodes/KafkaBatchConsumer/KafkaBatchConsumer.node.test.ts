/**
 * Step 7: Unit Tests (Jest)
 * Comprehensive test suite for Kafka Batch Consumer node
 * 
 * Test Coverage:
 * - Credentials handling (SASL PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, SSL/TLS)
 * - Connection management and error handling
 * - Message batch collection and size limits
 * - JSON parsing (valid/invalid)
 * - Timeout scenarios with partial batches
 * - Consumer cleanup and resource management
 * - Output format and metadata preservation
 * - Integration scenarios
 */

import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { KafkaBatchConsumer } from './KafkaBatchConsumer.node';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

// Mock KafkaJS library for testing
jest.mock('kafkajs');

describe('KafkaBatchConsumer', () => {
  let kafkaBatchConsumer: KafkaBatchConsumer;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockConsumer: jest.Mocked<Consumer>;
  let mockKafka: jest.Mocked<Kafka>;

  beforeEach(() => {
    // Reset all mocks before each test for isolation
    jest.clearAllMocks();

    // Create fresh node instance
    kafkaBatchConsumer = new KafkaBatchConsumer();

    /**
     * Mock Kafka Consumer
     * Provides test implementations for all consumer methods
     */
    mockConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      seek: jest.fn(),
      describeGroup: jest.fn().mockResolvedValue(undefined),
      commitOffsets: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      events: {} as any,
    } as any;

    // Mock Kafka
    mockKafka = {
      consumer: jest.fn().mockReturnValue(mockConsumer),
      producer: jest.fn(),
      admin: jest.fn(),
      logger: jest.fn(),
    } as any;

    // Mock Kafka constructor to return mocked instance
    (Kafka as jest.MockedClass<typeof Kafka>).mockImplementation(() => mockKafka);

    /**
     * Mock N8N Execute Functions
     * Simulates N8N runtime environment
     */
    mockExecuteFunctions = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      getNode: jest.fn().mockReturnValue({ name: 'Kafka Batch Consumer' }),
      helpers: {} as any,
      continueOnFail: jest.fn().mockReturnValue(false),
    } as any;
  });

  // ======================
  // Setup and basic tests
  // ======================

  describe('Node description', () => {
    it('should have correct node properties', () => {
      expect(kafkaBatchConsumer.description.displayName).toBe('Kafka Batch Consumer');
      expect(kafkaBatchConsumer.description.name).toBe('kafkaBatchConsumer');
      expect(kafkaBatchConsumer.description.group).toContain('transform');
      expect(kafkaBatchConsumer.description.inputs).toEqual(['main']);
      expect(kafkaBatchConsumer.description.outputs).toEqual(['main']);
    });

    it('should have kafka credentials configured', () => {
      const credentials = kafkaBatchConsumer.description.credentials;
      expect(credentials).toBeDefined();
      expect(credentials).toHaveLength(1);
      expect(credentials![0].name).toBe('kafka');
      expect(credentials![0].required).toBe(false);
    });

    it('should have all required parameters', () => {
      const properties = kafkaBatchConsumer.description.properties;
      const paramNames = properties.map((p: any) => p.name);
      
      expect(paramNames).toContain('brokers');
      expect(paramNames).toContain('clientId');
      expect(paramNames).toContain('groupId');
      expect(paramNames).toContain('topic');
      expect(paramNames).toContain('batchSize');
      expect(paramNames).toContain('fromBeginning');
      expect(paramNames).toContain('sessionTimeout');
      expect(paramNames).toContain('options');
    });
  });

  // ======================
  // Credentials tests
  // Test SASL authentication mechanisms and SSL/TLS configurations
  // Verify proper mapping from N8N credentials to KafkaJS format
  // ======================

  describe('Credentials handling', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });
    });

    /**
     * Test unauthenticated connection
     * Verifies that node works without credentials for local/unsecured brokers
     */
    it('should connect without credentials', async () => {
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
      
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        // Don't send messages, let timeout occur
        // consumer.run never resolves - it runs forever
        return new Promise(() => {});
      });

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      // Verify Kafka initialized without SASL or SSL config
      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
      });
    });

    /**
     * Test SASL PLAIN authentication
     * Most basic SASL mechanism for username/password authentication
     */
    it('should connect with SASL PLAIN authentication', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'plain',
        username: 'test-user',
        password: 'test-pass',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      // Verify SASL PLAIN config passed to Kafka
      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        sasl: {
          mechanism: 'plain',
          username: 'test-user',
          password: 'test-pass',
        },
      });
    });

    it('should connect with SASL SCRAM-SHA-256 authentication', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'scram-sha-256',
        username: 'test-user',
        password: 'test-pass',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        sasl: {
          mechanism: 'scram-sha-256',
          username: 'test-user',
          password: 'test-pass',
        },
      });
    });

    it('should connect with SASL SCRAM-SHA-512 authentication', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'scram-sha-512',
        username: 'test-user',
        password: 'test-pass',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        sasl: {
          mechanism: 'scram-sha-512',
          username: 'test-user',
          password: 'test-pass',
        },
      });
    });

    it('should connect with SSL/TLS configuration', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        ssl: true,
        ca: 'ca-cert',
        cert: 'client-cert',
        key: 'client-key',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        ssl: {
          rejectUnauthorized: true,
          ca: 'ca-cert',
          cert: 'client-cert',
          key: 'client-key',
        },
      });
    });

    it('should connect with both SASL and SSL', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'plain',
        username: 'test-user',
        password: 'test-pass',
        ssl: true,
        ca: 'ca-cert',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        sasl: {
          mechanism: 'plain',
          username: 'test-user',
          password: 'test-pass',
        },
        ssl: {
          rejectUnauthorized: true,
          ca: 'ca-cert',
        },
      });
    });

    it('should handle SSL with rejectUnauthorized false', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        ssl: false,
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        ssl: {
          rejectUnauthorized: false,
        },
      });
    });

    it('should pass correct auth config to Kafka client', async () => {
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'scram-sha-256',
        username: 'user123',
        password: 'pass456',
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      const kafkaCall = (Kafka as jest.MockedClass<typeof Kafka>).mock.calls[0][0];
      expect(kafkaCall.sasl).toEqual({
        mechanism: 'scram-sha-256',
        username: 'user123',
        password: 'pass456',
      });
    });
  });

  // ======================
  // Connection tests
  // Test broker connection, error handling, and broker list parsing
  // ======================

  describe('Connection handling', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    it('should connect to Kafka brokers successfully', async () => {
      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.subscribe).toHaveBeenCalledTimes(1);
      expect(mockConsumer.run).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors', async () => {
      mockConsumer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(kafkaBatchConsumer.execute.call(mockExecuteFunctions)).rejects.toThrow(
        NodeOperationError
      );
    });

    it('should parse comma-separated brokers correctly', async () => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'brokers') return 'broker1:9092, broker2:9092, broker3:9092';
        const params: Record<string, any> = {
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'test-client',
        brokers: ['broker1:9092', 'broker2:9092', 'broker3:9092'],
      });
    });
  });

  // ======================
  // Subscription tests
  // Test topic subscription with fromBeginning flag
  // ======================

  describe('Topic subscription', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    it('should subscribe to topic with fromBeginning flag', async () => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'my-topic',
          batchSize: 5,
          fromBeginning: true,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });

      mockConsumer.run.mockImplementation(async () => Promise.resolve());

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'my-topic',
        fromBeginning: true,
      });
    });

    it('should handle subscription errors', async () => {
      mockConsumer.subscribe.mockRejectedValue(new Error('Subscription failed'));

      await expect(kafkaBatchConsumer.execute.call(mockExecuteFunctions)).rejects.toThrow(
        NodeOperationError
      );
    });
  });

  // ======================
  // Message collection tests
  // Test batch size limits, message metadata, and field handling
  // ======================

  describe('Message collection', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: { parseJson: true },
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    /**
     * Test exact batch size collection
     * Verifies that node collects exactly batchSize messages before stopping
     */
    it('should collect exact batchSize messages', async () => {
      const batchSize = 5;
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'batchSize') return batchSize;
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          fromBeginning: false,
          sessionTimeout: 30000,
          options: { parseJson: true },
        };
        return params[paramName];
      });

      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        // Simulate receiving exactly batchSize messages
        for (let i = 0; i < batchSize; i++) {
          await eachMessage({
            topic: 'test-topic',
            partition: 0,
            message: {
              offset: String(i),
              key: Buffer.from(`key${i}`),
              value: Buffer.from(JSON.stringify({ id: i, data: `message${i}` })),
              timestamp: String(Date.now()),
              headers: {},
            },
          });
        }
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(batchSize);
    });

    it('should stop collecting when batchSize reached', async () => {
      let messageCount = 0;
      
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        // Try to send 10 messages but batch size is 5
        for (let i = 0; i < 10; i++) {
          await eachMessage({
            topic: 'test-topic',
            partition: 0,
            message: {
              offset: String(i),
              key: Buffer.from(`key${i}`),
              value: Buffer.from(JSON.stringify({ id: i })),
              timestamp: String(Date.now()),
              headers: {},
            },
          });
          messageCount++;
          
          // Stop if we've reached batch size
          if (messageCount >= 5) {
            break;
          }
        }
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(5);
    });

    it('should handle messages with all metadata fields', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 2,
          message: {
            offset: '12345',
            key: Buffer.from('message-key'),
            value: Buffer.from(JSON.stringify({ data: 'test' })),
            timestamp: '1234567890000',
            headers: { 'custom-header': Buffer.from('header-value') },
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toHaveProperty('topic', 'test-topic');
      expect(result[0][0].json).toHaveProperty('partition', 2);
      expect(result[0][0].json).toHaveProperty('offset', '12345');
      expect(result[0][0].json).toHaveProperty('key', 'message-key');
      expect(result[0][0].json).toHaveProperty('value');
      expect(result[0][0].json).toHaveProperty('timestamp', '1234567890000');
      expect(result[0][0].json).toHaveProperty('headers');
    });

    it('should handle messages with missing optional fields', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '100',
            key: null,
            value: Buffer.from('simple message'),
            timestamp: '1234567890000',
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json.key).toBeNull();
    });
  });

  // ======================
  // JSON parsing tests
  // Test valid JSON parsing, string preservation, and invalid JSON handling
  // ======================

  describe('JSON parsing', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: { parseJson: true },
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    /**
     * Test valid JSON parsing
     * When parseJson=true, valid JSON strings should be parsed to objects
     */
    it('should parse valid JSON when parseJson=true', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: Buffer.from('key1'),
            value: Buffer.from(JSON.stringify({ name: 'test', count: 42 })),
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      // Verify JSON was parsed to object
      expect(result[0][0].json.value).toEqual({ name: 'test', count: 42 });
    });

    it('should keep string when parseJson=false', async () => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'options') return { parseJson: false };
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
        };
        return params[paramName];
      });

      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: Buffer.from('key1'),
            value: Buffer.from(JSON.stringify({ name: 'test' })),
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(typeof result[0][0].json.value).toBe('string');
      expect(result[0][0].json.value).toBe('{"name":"test"}');
    });

    it('should keep string when JSON invalid and parseJson=true', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: Buffer.from('key1'),
            value: Buffer.from('not valid json {'),
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(typeof result[0][0].json.value).toBe('string');
      expect(result[0][0].json.value).toBe('not valid json {');
    });
  });

  // ======================
  // Timeout tests
  // Test readTimeout option and partial batch collection on timeout
  // ======================

  describe('Timeout handling', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 10,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: { readTimeout: 100, parseJson: true },
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    it('should timeout when not enough messages', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        // Send only 3 messages when batch size is 10
        for (let i = 0; i < 3; i++) {
          await eachMessage({
            topic: 'test-topic',
            partition: 0,
            message: {
              offset: String(i),
              key: Buffer.from(`key${i}`),
              value: Buffer.from(JSON.stringify({ id: i })),
              timestamp: String(Date.now()),
              headers: {},
            },
          });
        }
        
        // Wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(3);
    });

    it('should collect partial batch on timeout', async () => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'batchSize') return 10;
        if (paramName === 'options') return { readTimeout: 100 };
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          fromBeginning: false,
          sessionTimeout: 30000,
        };
        return params[paramName];
      });

      let messagesSent = 0;
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        // Send 5 messages
        for (let i = 0; i < 5; i++) {
          await eachMessage({
            topic: 'test-topic',
            partition: 0,
            message: {
              offset: String(i),
              key: Buffer.from(`key${i}`),
              value: Buffer.from(`message${i}`),
              timestamp: String(Date.now()),
              headers: {},
            },
          });
          messagesSent++;
        }
        
        // Wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0].length).toBeLessThan(10);
      expect(result[0].length).toBe(5);
    });

    it('should respect readTimeout option', async () => {
      const readTimeout = 200;
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        if (paramName === 'options') return { readTimeout };
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 10,
          fromBeginning: false,
          sessionTimeout: 30000,
        };
        return params[paramName];
      });

      const startTime = Date.now();
      
      mockConsumer.run.mockImplementation(async () => {
        // Don't send any messages, just wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 250));
      });

      await kafkaBatchConsumer.execute.call(mockExecuteFunctions);
      
      const duration = Date.now() - startTime;
      
      // Should timeout around readTimeout value (with some tolerance)
      expect(duration).toBeGreaterThanOrEqual(readTimeout);
      expect(duration).toBeLessThan(readTimeout + 100);
    });
  });

  // ======================
  // Error handling tests
  // Test consumer cleanup, NodeOperationError wrapping, and resource management
  // ======================

  describe('Error handling', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 5,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: {},
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    /**
     * Test consumer cleanup on error
     * Verifies that consumer is always disconnected, even when errors occur
     */
    it('should disconnect consumer on error', async () => {
      mockConsumer.run.mockRejectedValue(new Error('Kafka error'));

      await expect(kafkaBatchConsumer.execute.call(mockExecuteFunctions)).rejects.toThrow();

      // Verify disconnect was called for cleanup
      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });

    it('should throw NodeOperationError on Kafka errors', async () => {
      mockConsumer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(kafkaBatchConsumer.execute.call(mockExecuteFunctions)).rejects.toThrow(
        NodeOperationError
      );
    });

    it('should cleanup resources in finally block', async () => {
      mockConsumer.run.mockRejectedValue(new Error('Run error'));

      try {
        await kafkaBatchConsumer.execute.call(mockExecuteFunctions);
      } catch (error) {
        // Expected error
      }

      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockConsumer.run.mockRejectedValue(new Error('Run error'));
      mockConsumer.disconnect.mockRejectedValue(new Error('Disconnect error'));

      await expect(kafkaBatchConsumer.execute.call(mockExecuteFunctions)).rejects.toThrow(
        NodeOperationError
      );
      
      // Should still attempt disconnect
      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });
  });

  // ======================
  // Output format tests
  // Test INodeExecutionData format, field inclusion, and edge cases
  // ======================

  describe('Output format', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'test-group',
          topic: 'test-topic',
          batchSize: 3,
          fromBeginning: false,
          sessionTimeout: 30000,
          options: { parseJson: true },
        };
        return params[paramName];
      });
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    it('should return INodeExecutionData array', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: Buffer.from('key1'),
            value: Buffer.from(JSON.stringify({ data: 'test' })),
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(Array.isArray(result)).toBe(true);
      expect(Array.isArray(result[0])).toBe(true);
      expect(result[0][0]).toHaveProperty('json');
    });

    it('should include topic, partition, offset, key, value, timestamp, headers', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'my-topic',
          partition: 3,
          message: {
            offset: '999',
            key: Buffer.from('my-key'),
            value: Buffer.from(JSON.stringify({ field: 'value' })),
            timestamp: '9876543210',
            headers: { header1: Buffer.from('value1') },
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      const message = result[0][0].json;
      expect(message.topic).toBe('my-topic');
      expect(message.partition).toBe(3);
      expect(message.offset).toBe('999');
      expect(message.key).toBe('my-key');
      expect(message.value).toEqual({ field: 'value' });
      expect(message.timestamp).toBe('9876543210');
      expect(message.headers).toEqual({ header1: Buffer.from('value1') });
    });

    it('should handle null message keys', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: null,
            value: Buffer.from('test message'),
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0][0].json.key).toBeNull();
    });

    it('should handle empty message value', async () => {
      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        await eachMessage({
          topic: 'test-topic',
          partition: 0,
          message: {
            offset: '1',
            key: Buffer.from('key1'),
            value: null,
            timestamp: String(Date.now()),
            headers: {},
          },
        });
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      expect(result[0][0].json.value).toBe('');
    });
  });

  // ======================
  // Integration tests
  // Test complete workflow with authentication, subscription, and message collection
  // ======================

  describe('Integration scenarios', () => {
    beforeEach(() => {
      mockExecuteFunctions.getCredentials.mockRejectedValue(new Error('No credentials'));
    });

    /**
     * Integration test: Complete workflow
     * Tests full flow from credentials to message collection with all features:
     * - Multiple brokers
     * - SCRAM-SHA-256 authentication
     * - SSL configuration
     * - fromBeginning subscription
     * - Batch collection
     * - JSON parsing
     * - Proper cleanup
     */
    it('should handle complete workflow with authentication', async () => {
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string) => {
        const params: Record<string, any> = {
          brokers: 'broker1:9092,broker2:9092',
          clientId: 'integration-client',
          groupId: 'integration-group',
          topic: 'integration-topic',
          batchSize: 3,
          fromBeginning: true,
          sessionTimeout: 25000,
          options: { readTimeout: 5000, parseJson: true },
        };
        return params[paramName];
      });

      mockExecuteFunctions.getCredentials.mockResolvedValue({
        authentication: 'scram-sha-256',
        username: 'integration-user',
        password: 'integration-pass',
        ssl: true,
      });

      mockConsumer.run.mockImplementation(async ({ eachMessage }: any) => {
        for (let i = 0; i < 3; i++) {
          await eachMessage({
            topic: 'integration-topic',
            partition: i,
            message: {
              offset: String(i * 100),
              key: Buffer.from(`key-${i}`),
              value: Buffer.from(JSON.stringify({ id: i, name: `item-${i}` })),
              timestamp: String(Date.now()),
              headers: { source: Buffer.from('integration-test') },
            },
          });
        }
      });

      const result = await kafkaBatchConsumer.execute.call(mockExecuteFunctions);

      // Verify Kafka configuration
      expect(Kafka).toHaveBeenCalledWith({
        clientId: 'integration-client',
        brokers: ['broker1:9092', 'broker2:9092'],
        sasl: {
          mechanism: 'scram-sha-256',
          username: 'integration-user',
          password: 'integration-pass',
        },
        ssl: {
          rejectUnauthorized: true,
        },
      });

      // Verify consumer setup
      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: 'integration-group',
        sessionTimeout: 25000,
      });

      // Verify subscription
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'integration-topic',
        fromBeginning: true,
      });

      // Verify results
      expect(result[0]).toHaveLength(3);
      expect(result[0][0].json.value).toEqual({ id: 0, name: 'item-0' });
      expect(result[0][1].json.value).toEqual({ id: 1, name: 'item-1' });
      expect(result[0][2].json.value).toEqual({ id: 2, name: 'item-2' });

      // Verify cleanup
      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });
  });
});
