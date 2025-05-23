import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, MinLength, MaxLength, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({
    description: 'The title of the ticket',
    example: 'Concert Ticket',
    minLength: 3,
    maxLength: 100
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the ticket',
    example: 'Front row seat for the concert on December 15th',
    minLength: 10,
    maxLength: 500
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description!: string;

  @ApiProperty({
    description: 'The price of the ticket in USD',
    example: 99.99,
    minimum: 0
  })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({
    description: 'The number of tickets available',
    example: 100,
    minimum: 1
  })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({
    description: 'The ID of the user who created the ticket',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  userId!: string;
}
