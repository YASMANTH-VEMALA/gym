import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client?: PrismaClient;
  constructor(private readonly config: ConfigService) {}
  get db(): PrismaClient {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString)
      throw new ServiceUnavailableException('Database is not configured');
    return (this.client ??= new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: [],
    }));
  }
  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}
