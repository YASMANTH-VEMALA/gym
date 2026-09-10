import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsUUID,
  ValidateNested,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  normalizeMemberPhone,
  memberPhonePattern,
  fitnessGoals,
} from '@gym/validation';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const phone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeMemberPhone(value) : value;
const phoneOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeMemberPhone(value) || null : value;
const emailOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;
export class EmergencyContactDto {
  @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @Transform(phone)
  @IsString()
  @Matches(memberPhonePattern, {
    message:
      'Contact phone must contain 6–15 digits with an optional leading +.',
  })
  phone!: string;
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string | null;
}
export class CreateMemberDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() branchId?:
    string | null;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 120) fullName!: string;
  @ApiProperty()
  @Transform(phone)
  @IsString()
  @Matches(memberPhonePattern, {
    message: 'Phone must contain 6–15 digits with an optional leading +.',
  })
  phone!: string;
  @ApiProperty({ example: '2026-09-08' })
  @Transform(trim)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  joiningDate!: string;
  @ApiPropertyOptional({ nullable: true })
  @Transform(phoneOptional)
  @IsOptional()
  @Matches(memberPhonePattern)
  alternatePhone?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(emailOptional)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;
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
  @MaxLength(80)
  emergencyContactRelationship?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(phoneOptional)
  @IsOptional()
  @Matches(memberPhonePattern)
  emergencyContactPhone?: string | null;
  @ApiPropertyOptional({ type: [EmergencyContactDto], maxItems: 5 })
  @IsOptional()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
  @ApiPropertyOptional({
    nullable: true,
    description: 'JPEG, PNG or WebP data URL, maximum decoded size 1.5 MB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2100000)
  profilePhotoDataUrl?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsIn(fitnessGoals)
  fitnessGoal?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @Transform(optional)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  heightCm?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  weightGrams?: number | null;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
export class UpdateMemberDto extends PartialType(CreateMemberDto, {
  skipNullProperties: false,
}) {}
export class ListMembersDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
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
