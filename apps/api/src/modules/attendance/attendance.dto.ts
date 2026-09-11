import { Type, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class AttendanceQuery {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CheckInDto {
  @IsUUID() branchId!: string;
  @IsUUID() memberId!: string;
}

export class MonthlyMatrixQuery {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}

export class UpdateMatrixCellDto {
  @IsUUID() memberId!: string;
  @IsUUID() branchId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsIn(['PRESENT', 'ABSENT', 'REST', 'CLEAR'])
  status!: 'PRESENT' | 'ABSENT' | 'REST' | 'CLEAR';
  @IsOptional() @IsString() session?: string;
}

export class MarkAllTodayDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() session?: string;
}

export class GoogleSheetsSyncDto {
  @IsUUID() branchId!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @IsOptional() @IsString() sheetId?: string;
}
