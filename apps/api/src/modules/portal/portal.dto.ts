import { EmergencyContactDto } from '../members/members.dto';
import {
  Matches,
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
  Length,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { memberPhonePattern, normalizeMemberPhone } from '@gym/validation';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class RegisterMemberDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
  @Transform(trim) @IsString() @Length(1, 120) fullName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeMemberPhone(value) : value,
  )
  @IsString()
  @Matches(memberPhonePattern)
  phone!: string;
  @Transform(trim) @IsString() @Length(1, 50) gender!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) dateOfBirth!: string;
  @Transform(trim) @IsString() @Length(1, 500) addressLine1!: string;
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts!: EmergencyContactDto[];
  @IsOptional() @IsString() @MaxLength(2100000) profilePhotoDataUrl?: string;
}
export class MemberInviteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class MemberPageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
