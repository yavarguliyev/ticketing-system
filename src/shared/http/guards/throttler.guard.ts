import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface CustomRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: CustomRequest): Promise<string> {
    const ip: string = req.ips.length ? req.ips[0] : req.ip || '127.0.0.1';
    const userId: string = req.user?.id || 'anonymous';

    return Promise.resolve(`${ip}-${userId}`);
  }
}
