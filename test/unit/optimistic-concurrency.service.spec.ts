import { Test, TestingModule } from '@nestjs/testing';

import { OptimisticConcurrencyService } from '../../src/shared/database/services/optimistic-concurrency.service';

describe('OptimisticConcurrencyService', () => {
  let service: OptimisticConcurrencyService;
  let mockIsOptimisticLockError: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OptimisticConcurrencyService]
    }).compile();

    service = module.get<OptimisticConcurrencyService>(OptimisticConcurrencyService);
    mockIsOptimisticLockError = jest.spyOn(service, 'isOptimisticLockError' as keyof OptimisticConcurrencyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWithRetry', () => {
    it('should return operation result when successful on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry operation on optimistic lock error', async () => {
      const optimisticLockError = new Error('Version conflict');
      mockIsOptimisticLockError.mockImplementation((err) => err === optimisticLockError);

      const operation = jest.fn().mockRejectedValueOnce(optimisticLockError).mockResolvedValueOnce('success');

      const result = await service.executeWithRetry(operation, {
        initialDelay: 10,
        maxDelay: 20,
        maxRetries: 3,
        backoffFactor: 1.5
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockIsOptimisticLockError).toHaveBeenCalledWith(optimisticLockError);
    });

    it('should retry with exponential backoff', async () => {
      const optimisticLockError = new Error('Version conflict');
      mockIsOptimisticLockError.mockImplementation((err) => err === optimisticLockError);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(optimisticLockError)
        .mockRejectedValueOnce(optimisticLockError)
        .mockResolvedValueOnce('success');

      const result = await service.executeWithRetry(operation, {
        initialDelay: 10,
        maxDelay: 1000,
        maxRetries: 3,
        backoffFactor: 2
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockIsOptimisticLockError).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const optimisticLockError = new Error('Version conflict');
      mockIsOptimisticLockError.mockReturnValue(true);

      const operation = jest.fn().mockRejectedValue(optimisticLockError);

      await expect(
        service.executeWithRetry(
          operation,
          {
            initialDelay: 10,
            maxDelay: 20,
            maxRetries: 2,
            backoffFactor: 1
          },
          'test operation'
        )
      ).rejects.toThrow(/Failed to complete test operation after 2 retries/);

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw original error if not an optimistic lock error', async () => {
      const originalError = new Error('Different error');
      mockIsOptimisticLockError.mockReturnValue(false);

      const operation = jest.fn().mockRejectedValue(originalError);

      await expect(service.executeWithRetry(operation)).rejects.toThrow(originalError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
