/// <reference types="node" />

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

/**
 * Step 1: Node Interface
 * Implements INodeType with complete node description
 * Defines all Kafka configuration properties
 * Includes optional credentials reference for authentication
 */
export class KafkaBatchConsumer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kafka Batch Consumer',
    name: 'kafkaBatchConsumer',
    icon: 'file:kafka.svg',
    group: ['transform'],
    version: 1,
    description: 'Consume messages from Kafka in batches',
    defaults: {
      name: 'Kafka Batch Consumer',
    },
    inputs: ['main'],
    outputs: ['main'],
    // Credentials reference - required for brokers and clientId configuration
    credentials: [
      {
        name: 'kafka',
        required: true,
      },
    ],
    // Define all Kafka configuration properties
    properties: [
      {
        displayName: 'Group ID',
        name: 'groupId',
        type: 'string',
        default: 'n8n-consumer-group',
        required: true,
        description: 'Consumer group identifier',
      },
      {
        displayName: 'Topic',
        name: 'topic',
        type: 'string',
        default: '',
        required: true,
        description: 'Kafka topic to consume from',
      },
      {
        displayName: 'Batch Size',
        name: 'batchSize',
        type: 'number',
        default: 10,
        required: true,
        description: 'Number of messages to consume in a batch',
      },
      {
        displayName: 'From Beginning',
        name: 'fromBeginning',
        type: 'boolean',
        default: false,
        description: 'Whether to read from the beginning of the topic',
      },
      {
        displayName: 'Session Timeout',
        name: 'sessionTimeout',
        type: 'number',
        default: 30000,
        description: 'Session timeout in milliseconds',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Read Timeout',
            name: 'readTimeout',
            type: 'number',
            default: 60000,
            description: 'Maximum time to wait for messages in milliseconds',
          },
          {
            displayName: 'Parse JSON',
            name: 'parseJson',
            type: 'boolean',
            default: true,
            description: 'Whether to parse message values as JSON',
          },
        ],
      },
    ],
  };

  /**
   * Main execution method
   * Handles the complete workflow: credentials, connection, consumption, and error handling
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = [];

    // Get all node parameters from N8N configuration
    const groupId = this.getNodeParameter('groupId', 0) as string;
    const topic = this.getNodeParameter('topic', 0) as string;
    const batchSize = this.getNodeParameter('batchSize', 0) as number;
    const fromBeginning = this.getNodeParameter('fromBeginning', 0) as boolean;
    const sessionTimeout = this.getNodeParameter('sessionTimeout', 0) as number;
    const options = this.getNodeParameter('options', 0) as {
      readTimeout?: number;
      parseJson?: boolean;
    };

    const readTimeout = options.readTimeout || 60000;
    const parseJson = options.parseJson !== undefined ? options.parseJson : true;

    /**
     * Step 2: Credentials Retrieval and Kafka Configuration
     * Build KafkaJS configuration with optional authentication
     * Supports SASL (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512) and SSL/TLS
     * Brokers and clientId are now taken from credentials
     */
    
    // Attempt to retrieve Kafka credentials (required for brokers and clientId)
    let credentials: any = null;
    try {
      credentials = await this.getCredentials('kafka');
    } catch (error) {
      throw new NodeOperationError(
        this.getNode(),
        'Kafka credentials are required to get brokers and clientId configuration'
      );
    }

    // Build base Kafka configuration from credentials
    const kafkaConfig: any = {
      clientId: credentials.clientId || 'n8n-kafka-batch-consumer',
      brokers: credentials.brokers ? 
        (typeof credentials.brokers === 'string' ? 
          credentials.brokers.split(',').map((b: string) => b.trim()) : 
          credentials.brokers) : 
        ['localhost:9092'],
    };

    // Map N8N credential fields to KafkaJS authentication format
    // Add SASL authentication if provided
    if (credentials.authentication) {
      kafkaConfig.sasl = {
        mechanism: credentials.authentication, // PLAIN, SCRAM-SHA-256, or SCRAM-SHA-512
        username: credentials.username,
        password: credentials.password,
      };
    }

    // Add SSL/TLS configuration for encrypted connections
    if (credentials.ssl !== undefined) {
      kafkaConfig.ssl = {
        rejectUnauthorized: credentials.ssl, // Validate server certificates
      };

      // Add optional SSL certificates for mutual TLS authentication
      if (credentials.ca) {
        kafkaConfig.ssl.ca = credentials.ca; // Certificate Authority
      }
      if (credentials.cert) {
        kafkaConfig.ssl.cert = credentials.cert; // Client certificate
      }
      if (credentials.key) {
        kafkaConfig.ssl.key = credentials.key; // Client private key
      }
    }

    /**
     * Step 3: Consumer Setup
     * Initialize Kafka client and consumer with configuration
     * Connect to brokers and subscribe to topic
     */
    // Create Kafka instance with complete configuration
    const kafka = new Kafka(kafkaConfig);
    // Create consumer with group ID and session timeout
    const consumer: Consumer = kafka.consumer({
      groupId, // Consumer group for load balancing and offset management
      sessionTimeout, // Session timeout in milliseconds
    });

    // Track connection state for proper cleanup
    let consumerConnected = false;

    try {
      // Establish connection to Kafka brokers
      await consumer.connect();
      consumerConnected = true;

      // Subscribe to the specified topic
      // fromBeginning: if true, read from start; if false, read from latest
      await consumer.subscribe({ topic, fromBeginning });

      /**
       * Step 4: Message Collection
       * Collect messages in batch with timeout support
       * Stop when batch size reached or timeout occurs
       */
      // Initialize message collection array
      const messages: INodeExecutionData[] = [];
      let timeoutHandle: NodeJS.Timeout | null = null;
      let resolvePromise: ((value: void) => void) | null = null;

      const collectionPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      // Set maximum wait time for message collection
      timeoutHandle = setTimeout(() => {
        if (resolvePromise) {
          resolvePromise(); // Resolve with partial batch on timeout
        }
      }, readTimeout);

      /**
       * Start message consumption
       * eachMessage callback processes messages one by one
       * Collects until batch size or timeout reached
       * Note: consumer.run() starts the consumer but doesn't block
       */
      consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          /**
           * Step 6: Output Format
           * Process each message and format for N8N output
           * Parse JSON if configured, preserve metadata
           */
          // Parse message value from Buffer to string from Buffer to string
          let value: any = message.value?.toString() || '';
          
          // Attempt JSON parsing if configured
          if (parseJson && value) {
            try {
              value = JSON.parse(value); // Parse valid JSON to object
            } catch (error) {
              // Keep as string if JSON parsing fails (invalid JSON)
            }
          }

          // Build N8N execution data with complete Kafka message metadata
          const messageData: INodeExecutionData = {
            json: {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString() || null,
              value,
              timestamp: message.timestamp,
              headers: message.headers || {},
            },
          };

          messages.push(messageData);

          // Check if batch size reached
          if (messages.length >= batchSize) {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle); // Cancel timeout
            }
            if (resolvePromise) {
              resolvePromise(); // Complete batch collection
            }
          }
        },
      });

      /**
       * Wait for collection to complete
       * Completes when: batch size reached OR timeout occurs
       * Partial batches are valid on timeout
       */
      await collectionPromise;

      // Gracefully disconnect consumer and cleanup resources
      await consumer.disconnect();
      consumerConnected = false;

      // Add collected messages to return data
      returnData.push(...messages);
    } catch (error) {
      // Ensure consumer is disconnected
      if (consumerConnected) {
        try {
          await consumer.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors
        }
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new NodeOperationError(
        this.getNode(),
        `Kafka error: ${errorMessage}`,
        { description: errorMessage }
      );
    }

    return [returnData];
  }
}
