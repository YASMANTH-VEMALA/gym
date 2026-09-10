import { IsOptional,IsIn,IsUUID,Matches,IsInt,Min,Max } from 'class-validator';
import { Type } from 'class-transformer';
export class ReportQuery {
 @IsOptional() @IsUUID() branchId?:string;
 @IsOptional() @IsUUID() planId?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?:string;
 @IsOptional() @IsIn(['ALL','ACTIVE','UPCOMING','EXPIRED','CANCELLED','INACTIVE','ARCHIVED','OPEN','PARTIALLY_PAID','PAID','OVERDUE','VOID']) status='ALL';
 @IsOptional() @IsIn(['ALL','CASH','UPI','BANK_TRANSFER','CARD','OTHER']) method='ALL';
 @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page=1;
 @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=20;
}
