import { Transform, Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class MembershipQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') memberId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') planId?: string;
  @ApiPropertyOptional()
  @IsIn(['ALL', 'ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED'])
  status = 'ALL';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
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
export class CreateMembershipDto {
  @ApiProperty() @IsUUID('4') memberId!: string;
  @ApiProperty() @IsUUID('4') branchId!: string;
  @ApiProperty() @IsUUID('4') planId!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @ApiProperty() @IsUUID('4') idempotencyKey!: string;
}
export class ReasonDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  reason!: string;
}
