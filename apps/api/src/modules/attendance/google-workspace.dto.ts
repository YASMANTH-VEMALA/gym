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

export class GoogleOauthStartDto {
  @IsOptional()
  @IsString()
  @Matches(/^\/admin\//)
  returnTo?: string;
}

export class GoogleWorkspaceSyncDto {
  @IsUUID() branchId!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @IsIn(['PUSH', 'PULL']) direction!: 'PUSH' | 'PULL';
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  sheetId?: string;
}
