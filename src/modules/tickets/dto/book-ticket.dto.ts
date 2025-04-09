import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min, IsOptional, IsString } from 'class-validator';

export class BookTicketDto {
  @ApiProperty({
    description: 'Number of tickets to book',
    example: 2,
    minimum: 1,
    required: true
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'User ID for the booking (optional, will use authenticated user by default)',
    example: 'user-123',
    required: false
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
