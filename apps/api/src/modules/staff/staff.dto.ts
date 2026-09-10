import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateStaffDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) fullName!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[+0-9().\s#xX-]{6,32}$/, {
    message: 'Enter a valid phone number (6–32 characters)',
  })
  phone!: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 100) jobTitle!: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string | null;
  @ApiPropertyOptional({ nullable: true, example: '1990-05-20' })
  @Transform(optional)
  @IsOptional()
  @Matches(datePattern)
  dateOfBirth?: string | null;
  @ApiProperty({ example: '2026-09-07' })
  @Transform(trim)
  @Matches(datePattern)
  joiningDate!: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @Matches(/^[+0-9().\s#xX-]{6,32}$/)
  emergencyContactPhone?: string | null;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds!: string[];
}

export class UpdateStaffDto extends PartialType(CreateStaffDto, {
  skipNullProperties: false,
}) {}

export class ListStaffDto {
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
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') branchId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;
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
