import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';

import { SeedingService } from './seeding.service';

@Injectable()
export class SeedCommand {
  constructor(private readonly seedingService: SeedingService) {}

  @Command({
    command: 'seed',
    describe: 'Seed the database'
  })
  async seed(): Promise<void> {
    await this.seedingService.seed();
  }

  @Command({
    command: 'seed:clear',
    describe: 'Clear seeded data'
  })
  async clear(): Promise<void> {
    await this.seedingService.clear();
  }
}
