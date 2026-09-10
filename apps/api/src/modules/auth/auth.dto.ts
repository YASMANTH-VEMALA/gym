import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class OnboardingDto {
  @IsString()
  @Length(1, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;
  @IsString()
  @Length(1, 100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  branchName!: string;
  @IsIn(['INR', 'USD', 'EUR', 'GBP', 'AED']) currency: string = 'INR';
  @IsString() @MaxLength(100) timezone: string = 'Asia/Kolkata';
}
export class InviteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class AcceptInviteDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
