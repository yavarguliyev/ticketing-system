import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

import { CreateTicketDto } from './create-ticket.dto';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiProperty({ description: 'Fields to update in the ticket' })
  override title?: string;

  @ApiProperty({ description: 'Updated description' })
  override description?: string;

  @ApiProperty({ description: 'Updated price' })
  override price?: number;

  @ApiProperty({ description: 'Updated quantity' })
  override quantity?: number;

  @ApiProperty({
    description: 'Version of the ticket for optimistic concurrency control',
    example: 1,
    required: true
  })
  @IsInt()
  @IsOptional()
  version?: number;
}
