import { SetMetadata } from '@nestjs/common';

export const THROTTLER_LIMIT = 'THROTTLER_LIMIT';
export const THROTTLER_TTL = 'THROTTLER_TTL';
export const THROTTLER_SKIP = 'THROTTLER_SKIP';

export type CustomThrottlerOptions = {
  limit: number;
  ttl: number;
}

export const Throttle = (limit: number, ttl: number) => 
  SetMetadata<string, CustomThrottlerOptions>(THROTTLER_LIMIT, { limit, ttl });

export const SkipThrottle = (skip = true) => 
  SetMetadata<string, boolean>(THROTTLER_SKIP, skip);

export const HighRateLimit = () => Throttle(100, 60000);
export const MediumRateLimit = () => Throttle(30, 60000);
export const LowRateLimit = () => Throttle(10, 60000);
export const SensitiveRateLimit = () => Throttle(5, 60000); 