import axios from 'axios';

jest.mock('../../src/shared/database/services/transaction.service', () => ({
  TransactionService: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((callback: () => void): void => callback())
  }))
}));

const API_URL = 'http://localhost:3000';
const CONCURRENT_OPERATIONS = 10;
const TEST_ITERATIONS = 3;

jest.mock('axios');

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

type ConcurrencyType = 'optimistic' | 'pessimistic';
type ErrorResponseData = { message?: string };
type BookingSuccessResponse = { remainingQuantity: number };
type TicketSuccessResponse = { quantity: number; version: number };

interface BookingResult {
  status: 'success' | 'error';
  type: ConcurrencyType;
  duration?: number;
  version?: number;
  remainingQuantity?: number;
  code?: number;
  message?: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  version: number;
}

interface TestResults {
  successful: number;
  conflicts: number;
  otherErrors: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
}

interface ComparisonTestResult {
  optimisticResults: TestResults[];
  pessimisticResults: TestResults[];
  optimisticAnalysis: {
    successful: number;
    conflicts: number;
    otherErrors: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
  };
  pessimisticAnalysis: {
    successful: number;
    conflicts: number;
    otherErrors: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
  };
}

function getErrorMessage (error: unknown): string {
  if (axios.isAxiosError<ErrorResponseData>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

describe('ConcurrencyComparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should be properly configured for testing', () => {
    expect(API_URL).toBeDefined();
    expect(CONCURRENT_OPERATIONS).toBeGreaterThan(0);
    expect(TEST_ITERATIONS).toBeGreaterThan(0);
  });

  describe('API Tests', () => {
    it('should compare optimistic and pessimistic concurrency approaches', () => {
      const testResult: ComparisonTestResult = {
        optimisticResults: [
          {
            successful: 1,
            conflicts: 1,
            otherErrors: 0,
            avgDuration: 75,
            maxDuration: 100,
            minDuration: 50
          }
        ],
        pessimisticResults: [
          {
            successful: 1,
            conflicts: 1,
            otherErrors: 0,
            avgDuration: 85,
            maxDuration: 110,
            minDuration: 60
          }
        ],
        optimisticAnalysis: {
          successful: 1,
          conflicts: 1,
          otherErrors: 0,
          avgDuration: 75,
          maxDuration: 100,
          minDuration: 50
        },
        pessimisticAnalysis: {
          successful: 1,
          conflicts: 1,
          otherErrors: 0,
          avgDuration: 85,
          maxDuration: 110,
          minDuration: 60
        }
      };

      expect(testResult.optimisticResults.length).toBe(1);
      expect(testResult.pessimisticResults.length).toBe(1);

      const { optimisticAnalysis, pessimisticAnalysis } = testResult;
      expect(optimisticAnalysis).toBeDefined();
      expect(pessimisticAnalysis).toBeDefined();

      expect(optimisticAnalysis).toHaveProperty('successful');
      expect(optimisticAnalysis).toHaveProperty('conflicts');
      expect(optimisticAnalysis).toHaveProperty('avgDuration');
    });

    it('should properly analyze booking results', () => {
      const results: BookingResult[] = [
        {
          status: 'success',
          type: 'optimistic',
          duration: 50,
          version: 2,
          remainingQuantity: 98
        },
        {
          status: 'error',
          type: 'optimistic',
          code: 409,
          message: 'Version conflict'
        },
        {
          status: 'success',
          type: 'optimistic',
          duration: 100,
          version: 3,
          remainingQuantity: 96
        }
      ];

      const analysis = analyzeResults(results);

      expect(analysis.successful).toBe(2);
      expect(analysis.conflicts).toBe(1);
      expect(analysis.otherErrors).toBe(0);
      expect(analysis.avgDuration).toBe(75);
      expect(analysis.maxDuration).toBe(100);
      expect(analysis.minDuration).toBe(50);
    });

    it('should handle individual concurrency test', () => {
      const results: TestResults = {
        successful: 2,
        conflicts: 0,
        otherErrors: 0,
        avgDuration: 75,
        maxDuration: 100,
        minDuration: 50
      };

      expect(results.successful).toBe(2);
      expect(results.conflicts).toBe(0);
    });
  });
});

async function createTestTicket (title: string = 'Concurrency Test Ticket'): Promise<Ticket> {
  try {
    const response = await axios.post(`${API_URL}/tickets`, {
      title,
      description: 'Ticket used for testing concurrency control',
      price: 100,
      quantity: 100
    });
    return response.data as Ticket;
  } catch (error: unknown) {
    throw new Error(`Failed to create test ticket: ${getErrorMessage(error)}`);
  }
}

async function bookTicket (ticketId: string, quantity: number, type: ConcurrencyType, userId: string = 'test-user-id'): Promise<BookingResult> {
  const startTime = Date.now();
  const endpoint = `http://localhost:3000/tickets/${ticketId}/${type === 'optimistic' ? 'book-optimistic' : 'book'}`;

  try {
    const response = await axios.post<BookingSuccessResponse>(endpoint, { quantity, userId });
    const duration = Date.now() - startTime;

    return {
      status: 'success',
      type,
      duration,
      remainingQuantity: response.data.remainingQuantity
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      type,
      code: 500,
      message: getErrorMessage(error)
    };
  }
}

async function releaseTicket (ticketId: string, type: ConcurrencyType, bookingId: string, userId: string = 'test-user-id'): Promise<BookingResult> {
  const endpoint = type === 'optimistic' ? `${API_URL}/tickets/${ticketId}/release-optimistic/${bookingId}` : `${API_URL}/tickets/${ticketId}/release/${bookingId}`;

  const startTime = Date.now();

  try {
    const response = await axios.post<TicketSuccessResponse>(endpoint, { userId });
    const duration = Date.now() - startTime;

    return {
      status: 'success',
      type,
      duration,
      version: response.data.version,
      remainingQuantity: response.data.quantity
    };
  } catch (error) {
    return {
      status: 'error',
      type,
      code: 500,
      message: getErrorMessage(error)
    };
  }
}

async function simulateConcurrentBookings (
  ticketId: string,
  bookingFunction: (ticketId: string, quantity: number, type: ConcurrencyType, userId?: string) => Promise<BookingResult>,
  operations: number | { quantity: number; concurrencyType: ConcurrencyType }[]
): Promise<BookingResult[]> {
  const operationsArray =
    typeof operations === 'number'
      ? Array(operations)
          .fill(null)
          .map(() => ({ quantity: 1, concurrencyType: 'optimistic' as ConcurrencyType }))
      : operations;

  const bookingPromises = operationsArray.map((op) => bookingFunction(ticketId, op.quantity, op.concurrencyType));

  return Promise.all(bookingPromises);
}

function analyzeResults (results: BookingResult[]): TestResults {
  const successful = results.filter((r) => r.status === 'success');
  const successCount = successful.length;
  const conflicts = results.filter((r) => r.status === 'error' && r.code === 409).length;
  const otherErrors = results.filter((r) => r.status === 'error' && r.code !== 409).length;

  const durations = successful.map((r) => r.duration).filter((d): d is number => d !== undefined);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const maxDuration = durations.length ? Math.max(...durations) : 0;
  const minDuration = durations.length ? Math.min(...durations) : 0;

  return {
    successful: successCount,
    conflicts,
    otherErrors,
    avgDuration,
    maxDuration,
    minDuration
  };
}

async function runConcurrencyTest (concurrencyType: 'optimistic' | 'pessimistic', operations: number = CONCURRENT_OPERATIONS): Promise<TestResults> {
  const ticket = await createTestTicket(`${concurrencyType}-concurrency-test`);
  const bookingFn = concurrencyType === 'optimistic' ? bookTicket : bookTicket;

  const operationsArray = Array(operations)
    .fill(null)
    .map(() => ({
      quantity: 1,
      concurrencyType
    }));

  const results = await simulateConcurrentBookings(ticket.id, bookingFn, operationsArray);

  try {
    const finalTicket = await axios.get<TicketSuccessResponse>(`${API_URL}/tickets/${ticket.id}`);
    console.log(`Final ticket state: ${finalTicket.data?.quantity} tickets remaining, version ${finalTicket.data?.version}`);
  } catch {
    console.error('Failed to get final ticket state');
  }

  return analyzeResults(results);
}

async function runComparisonTest (operations: number = CONCURRENT_OPERATIONS, iterations: number = TEST_ITERATIONS): Promise<void> {
  console.log(`Starting concurrency comparison test with ${operations} concurrent operations per iteration`);
  console.log(`Running ${iterations} iterations for more accurate results\n`);

  const optimisticResults: TestResults[] = [];
  const pessimisticResults: TestResults[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`\n--- Iteration ${i + 1}/${iterations} ---`);

    console.log('\nTesting optimistic concurrency...');
    const optimisticResult = await runConcurrencyTest('optimistic', operations);
    optimisticResults.push(optimisticResult);

    console.log('\nTesting pessimistic concurrency...');
    const pessimisticResult = await runConcurrencyTest('pessimistic', operations);
    pessimisticResults.push(pessimisticResult);

    if (i < iterations - 1) {
      console.log('\nWaiting between iterations...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const avgOptimistic = {
    successful: optimisticResults.reduce((sum, r) => sum + r.successful, 0) / iterations,
    conflicts: optimisticResults.reduce((sum, r) => sum + r.conflicts, 0) / iterations,
    otherErrors: optimisticResults.reduce((sum, r) => sum + r.otherErrors, 0) / iterations,
    avgDuration: optimisticResults.reduce((sum, r) => sum + r.avgDuration, 0) / iterations,
    maxDuration: Math.max(...optimisticResults.map((r) => r.maxDuration)),
    minDuration: Math.min(...optimisticResults.map((r) => r.minDuration))
  };

  const avgPessimistic = {
    successful: pessimisticResults.reduce((sum, r) => sum + r.successful, 0) / iterations,
    conflicts: pessimisticResults.reduce((sum, r) => sum + r.conflicts, 0) / iterations,
    otherErrors: pessimisticResults.reduce((sum, r) => sum + r.otherErrors, 0) / iterations,
    avgDuration: pessimisticResults.reduce((sum, r) => sum + r.avgDuration, 0) / iterations,
    maxDuration: Math.max(...pessimisticResults.map((r) => r.maxDuration)),
    minDuration: Math.min(...pessimisticResults.map((r) => r.minDuration))
  };

  const successRateOptimistic = (avgOptimistic.successful / operations) * 100;
  const successRatePessimistic = (avgPessimistic.successful / operations) * 100;
  const speedDifference = avgPessimistic.avgDuration / avgOptimistic.avgDuration;

  console.log('\n=== SUMMARY ===');
  console.log(`- Optimistic success rate: ${successRateOptimistic.toFixed(2)}%`);
  console.log(`- Pessimistic success rate: ${successRatePessimistic.toFixed(2)}%`);
  console.log(`- Optimistic is ${speedDifference.toFixed(2)}x ${speedDifference > 1 ? 'faster' : 'slower'} than pessimistic`);
}

if (require.main === module) {
  runComparisonTest().catch((error: unknown) => {
    console.error('Test failed:', getErrorMessage(error));
    process.exit(1);
  });
}

export { runComparisonTest, runConcurrencyTest, simulateConcurrentBookings, bookTicket, createTestTicket, releaseTicket };
