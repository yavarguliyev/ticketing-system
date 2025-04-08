import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersionColumnToTickets1744126340023 implements MigrationInterface {
    public async up (queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "version" integer NOT NULL DEFAULT 1`);
    }

    public async down (queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "version"`);
    }

}
