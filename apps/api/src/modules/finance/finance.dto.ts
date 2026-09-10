import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
export class FinanceQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') memberId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') membershipId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') branchId?: string;
  @ApiPropertyOptional()
  @IsIn([
    'ALL',
    'OUTSTANDING',
    'OPEN',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'VOID',
  ])
  status = 'OUTSTANDING';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueTo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  promiseDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidTo?: string;
  @ApiPropertyOptional()
  @IsIn(['ALL', 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'])
  paymentMethod = 'ALL';
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
export class RecordPaymentDto {
  @ApiProperty() @IsUUID('4') receivableId!: string;
  @ApiProperty() @IsUUID('4') idempotencyKey!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1000000000) amountMinor!: number;
  @ApiProperty()
  @IsIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'])
  method!: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidAt!: string;
  @ApiPropertyOptional()
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string | null;
  @ApiPropertyOptional()
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
export class PromiseDto {
  @ApiProperty({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  promiseToPayDate!: string | null;
}
