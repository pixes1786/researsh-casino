import { Module } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

@Module({})
export class RedisThrottlerModule {}

export function makeRedisStorage() {
  const url = process.env.REDIS_URL;
  if (!url) {
    // fallback to in-memory for local dev
    return undefined;
  }
  const client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  return new ThrottlerStorageRedisService(client);
}
