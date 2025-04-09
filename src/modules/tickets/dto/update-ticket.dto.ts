import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';

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
}
