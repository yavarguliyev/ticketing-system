import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketIndexes1712663000001 implements MigrationInterface {
  public async up (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_title" ON "tickets" ("title")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_userId" ON "tickets" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_createdAt" ON "tickets" ("createdAt")`);
  }

  public async down (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_title"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_createdAt"`);
  }
} 