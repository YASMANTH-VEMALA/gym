import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
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
