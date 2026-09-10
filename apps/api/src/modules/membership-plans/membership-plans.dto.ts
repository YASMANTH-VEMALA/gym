import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateMembershipPlanDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiProperty({
    minimum: 1,
    maximum: 1000000000,
    description: 'Integer minor units, e.g. 120000 = 1200.00',
  })
  @IsInt()
  @Min(1)
  @Max(1000000000)
  priceMinor!: number;
  @ApiProperty({ minimum: 1, maximum: 3650 })
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  appliesToAllBranches?: boolean;
  @ApiPropertyOptional({
    type: [String],
    description:
      'Required when selected-branch mode is used; omit or empty in all-branch mode',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds?: string[];
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
export class UpdateMembershipPlanDto extends PartialType(
  CreateMembershipPlanDto,
  { skipNullProperties: false },
) {}
export class ListMembershipPlansDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL'],
    default: 'ACTIVE',
  })
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'ALL'])
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE';
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') branchId?: string;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
