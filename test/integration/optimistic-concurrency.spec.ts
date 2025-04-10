import axios, { AxiosError, AxiosHeaders } from 'axios';

const API_URL = 'http://localhost:3000';
const CONCURRENT_OPERATIONS = 10;

interface Ticket {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  version: number;
}

interface BookingResult {
  status: 'success' | 'error';
  duration?: number;
  version?: number;
  remainingQuantity?: number;
  message?: string;
  code?: number;
}

interface AxiosErrorResponse {
  response?: {
    status: number;
    data: {
      message: string;
    };
  };
  message: string;
}

type ErrorResponseData = { message?: string };

function getErrorMessage (error: unknown): string {
  if (axios.isAxiosError<ErrorResponseData>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('OptimisticConcurrency', () => {
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
  });

  describe('API Tests', () => {
    const mockTicket: Ticket = {
      id: 'mock-ticket-id',
      title: 'Optimistic Concurrency Test',
      description: 'Ticket used for testing optimistic concurrency control',
      price: 100,
      quantity: 50,
      version: 1
    };

    it('should create a test ticket', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockTicket });

      const ticket = await createTestTicket();

      expect(ticket).toEqual(mockTicket);
    });

    it('should book tickets optimistically', async () => {
      const bookedTicket = { ...mockTicket, quantity: 48, version: 2 };
      mockedAxios.post.mockResolvedValueOnce({ data: bookedTicket });

      const result = await bookTicket(mockTicket.id, 2);

      expect(result.status).toBe('success');
      expect(result.remainingQuantity).toBe(48);
      expect(result.version).toBe(2);
    });

    it('should handle booking errors', async () => {
      mockedAxios.post.mockImplementationOnce(() => {
        const error = new Error('Version conflict detected');
        const axiosError = error as AxiosError;
        axiosError.response = {
          status: 409,
          statusText: 'Conflict',
          headers: new AxiosHeaders(),
          config: {
            headers: new AxiosHeaders()
          },
          data: { message: 'Version conflict detected' }
        };

        throw axiosError;
      });

      const result = await bookTicket(mockTicket.id, 2);

      expect(result.status).toBe('error');
      expect(result.code).toBe(409);
      expect(result.message).toBe('Version conflict detected');
    });

    it('should simulate concurrent bookings', async () => {
      const successResponse1 = { data: { ...mockTicket, quantity: 48, version: 2 } };
      const successResponse2 = { data: { ...mockTicket, quantity: 46, version: 3 } };

      mockedAxios.post
        .mockResolvedValueOnce(successResponse1)
        .mockImplementationOnce(() => {
          const error = new Error('Version conflict') as AxiosErrorResponse;
          const axiosError = error as AxiosError;
          axiosError.response = {
            status: 409,
            statusText: 'Conflict',
            headers: new AxiosHeaders(),
            config: {
              headers: new AxiosHeaders()
            },
            data: { message: 'Version conflict detected' }
          };

          throw axiosError;
        })
        .mockResolvedValueOnce(successResponse2);

      mockedAxios.get.mockResolvedValueOnce({
        data: { ...mockTicket, quantity: 46, version: 3 }
      });

      const results = await simulateConcurrentBookings(mockTicket.id, 3);

      const successfulResults = results.filter((r) => r.status === 'success');
      const errorResults = results.filter((r) => r.status === 'error');
      const conflictResults = results.filter((r) => r.status === 'error' && r.code === 409);

      expect(results.length).toBe(3);
      expect(successfulResults.length).toBe(2);
      expect(errorResults.length).toBe(1);
      expect(conflictResults.length).toBe(1);
    });

    it('should handle complete test flow', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockTicket });

      const operations = 5;
      for (let i = 0; i < operations; i++) {
        if (i % 2 === 0) {
          mockedAxios.post.mockResolvedValueOnce({
            data: {
              ...mockTicket,
              quantity: mockTicket.quantity - (i + 1),
              version: mockTicket.version + i + 1
            }
          });
        } else {
          mockedAxios.post.mockImplementationOnce(() => {
            const error = new Error('Version conflict') as AxiosErrorResponse;
            const axiosError = error as AxiosError;
            axiosError.response = {
              status: 409,
              statusText: 'Conflict',
              headers: new AxiosHeaders(),
              config: {
                headers: new AxiosHeaders()
              },
              data: { message: 'Version conflict detected' }
            };

            throw axiosError;
          });
        }
      }

      mockedAxios.get.mockResolvedValueOnce({
        data: { ...mockTicket, quantity: 44, version: 4 }
      });

      await expect(runOptimisticConcurrencyTest(operations)).resolves.not.toThrow();
    });
  });
});

async function createTestTicket (): Promise<Ticket> {
  try {
    const response = await axios.post(`${API_URL}/tickets`, {
      title: 'Optimistic Concurrency Test',
      description: 'Ticket used for testing optimistic concurrency control',
      price: 100,
      quantity: 50
    });
    return response.data as Ticket;
  } catch (error) {
    throw new Error(`Failed to create test ticket: ${getErrorMessage(error)}`);
  }
}

async function bookTicket (ticketId: string, quantity: number, userId: string = `user-${Math.floor(Math.random() * 1000)}`): Promise<BookingResult> {
  try {
    const startTime = Date.now();
    const response = await axios.post(`${API_URL}/tickets/${ticketId}/book-optimistic`, {
      quantity,
      userId
    });
    const duration = Date.now() - startTime;
    const responseData = response.data as Ticket;
    return {
      status: 'success',
      duration,
      version: responseData.version,
      remainingQuantity: responseData.quantity
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return {
        status: 'error',
        message: getErrorMessage(error),
        code: 500
      };
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const mockError = error as unknown as { response: { status: number; data: { message: string } } };
      return {
        status: 'error',
        message: mockError.response.data.message || 'Unknown error',
        code: mockError.response.status
      };
    }

    return {
      status: 'error',
      message: String(error)
    };
  }
}

async function simulateConcurrentBookings (ticketId: string, operations: number = CONCURRENT_OPERATIONS): Promise<BookingResult[]> {
  console.log(`Starting ${operations} concurrent booking operations for ticket ${ticketId}`);

  const operationPromises = Array(operations)
    .fill(null)
    .map(() => {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const delay = Math.random() * 100;
      return new Promise<BookingResult>((resolve) => {
        setTimeout(() => {
          void bookTicket(ticketId, quantity).then(resolve);
        }, delay);
      });
    });

  const results = await Promise.all(operationPromises);

  const successful = results.filter((r) => r.status === 'success').length;
  const conflicts = results.filter((r) => r.status === 'error' && r.code === 409).length;
  const otherErrors = results.filter((r) => r.status === 'error' && r.code !== 409).length;

  console.log('\nResults Summary:');
  console.log(`- Successful operations: ${successful}`);
  console.log(`- Version conflicts: ${conflicts}`);
  console.log(`- Other errors: ${otherErrors}`);

  try {
    const finalTicket = await axios.get(`${API_URL}/tickets/${ticketId}`);
    const finalTicketData = finalTicket.data as Ticket;
    console.log(`\nFinal ticket state:`);
    console.log(`- Version: ${finalTicketData.version}`);
    console.log(`- Remaining quantity: ${finalTicketData.quantity}`);
  } catch (error) {
    console.error('Failed to get final ticket state', getErrorMessage(error));
  }

  return results;
}

async function runOptimisticConcurrencyTest (operations: number = CONCURRENT_OPERATIONS): Promise<void> {
  const ticket = await createTestTicket();
  const results = await simulateConcurrentBookings(ticket.id, operations);

  results.forEach((result, index) => {
    if (result.status === 'success') {
      console.log(`Operation ${index + 1}: Success - Version: ${result.version}, Remaining: ${result.remainingQuantity} (took ${result.duration}ms)`);
    } else {
      console.log(`Operation ${index + 1}: Error - Code: ${result.code}, Message: ${result.message}`);
    }
  });
}

if (require.main === module) {
  runOptimisticConcurrencyTest().catch((error) => {
    console.error('Test failed:', getErrorMessage(error));
    process.exit(1);
  });
}

export { runOptimisticConcurrencyTest, simulateConcurrentBookings, bookTicket, createTestTicket };
