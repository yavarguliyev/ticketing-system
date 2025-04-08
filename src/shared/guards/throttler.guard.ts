import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker (req: Request): Promise<string> {
    const ip: string = req.ips.length ? req.ips[0] : (req.ip || '127.0.0.1');
    const userId: string = (req as any).user?.id || 'anonymous';
    return Promise.resolve(`${ip}-${userId}`);
  }
}
