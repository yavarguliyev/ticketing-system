import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity('tickets')
export class Ticket {
  @ApiProperty({
    description: 'The unique identifier for the ticket',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'The title of the ticket',
    example: 'Concert Ticket'
  })
  @Index()
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the ticket',
    example: 'Front row seat for the concert on December 15th'
  })
  @Column({ type: 'text' })
  description!: string;

  @ApiProperty({
    description: 'The price of the ticket in USD',
    example: 99.99
  })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @ApiProperty({
    description: 'The number of tickets available',
    example: 100
  })
  @Column({ type: 'integer' })
  quantity!: number;

  @ApiProperty({
    description: 'The ID of the user who created the ticket',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({
    description: 'The date and time when the ticket was created',
    example: '2025-04-08T15:06:45.836Z'
  })
  @Index()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @ApiProperty({
    description: 'The date and time when the ticket was last updated',
    example: '2025-04-08T15:06:45.836Z'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Version number used for optimistic concurrency control',
    example: 1
  })
  @VersionColumn()
  version!: number;
}
