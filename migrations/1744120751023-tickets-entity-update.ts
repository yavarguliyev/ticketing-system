import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketsEntityUpdate1744120751023 implements MigrationInterface {
    name = 'TicketsEntityUpdate1744120751023';

    public async up (queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_title"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tickets_createdAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "description" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "price" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "quantity" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_91df342f44d349b4fabadd3948" ON "tickets" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bb45e096f521845765f657f5c" ON "tickets" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e5a32949aaaa731c7ec0dc89e9" ON "tickets" ("createdAt") `);
    }

    public async down (queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_e5a32949aaaa731c7ec0dc89e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4bb45e096f521845765f657f5c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91df342f44d349b4fabadd3948"`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "quantity"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "price"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "description"`);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_createdAt" ON "tickets" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_userId" ON "tickets" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_tickets_title" ON "tickets" ("title") `);
    }

}
