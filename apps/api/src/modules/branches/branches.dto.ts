import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
export class CreateBranchDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) name!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  addressLine1!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) city!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) state!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  postalCode!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) country!: string;
  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,19}$/, {
    message: 'Code must be 2–20 letters, numbers, hyphens or underscores',
  })
  code?: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @Matches(/^[+0-9().\s#xX-]{6,32}$/, {
    message: 'Enter a valid phone number (6–32 characters)',
  })
  phone?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'IANA timezone; null inherits business timezone',
  })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string | null;
}
export class UpdateBranchDto extends PartialType(CreateBranchDto, {
  skipNullProperties: false,
}) {}
export class ListBranchesDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'ARCHIVED', 'ALL'],
    default: 'ACTIVE',
  })
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE';
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
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
