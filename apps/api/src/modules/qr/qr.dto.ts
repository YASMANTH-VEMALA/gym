import {
  IsIn,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
export class QrGenerateDto {
  @IsIn(['MEMBER', 'BRANCH']) kind!: 'MEMBER' | 'BRANCH';
  @IsUUID() targetId!: string;
  @IsOptional() @IsBoolean() rotate?: boolean;
}
export class QrQuery {
  @IsOptional() @IsIn(['MEMBER', 'BRANCH']) kind?: 'MEMBER' | 'BRANCH';
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class QrTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
export class QrCheckInDto extends QrTokenDto {
  @IsUUID() branchId!: string;
}
