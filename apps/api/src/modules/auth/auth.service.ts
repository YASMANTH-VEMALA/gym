import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTVerifyGetKey } from 'jose' with {
  'resolution-mode': 'import',
};
import { createClient } from '@supabase/supabase-js';

export interface Identity {
  userId: string;
  token: string;
}
export interface AuthRequest {
  headers: { authorization?: string };
  identity: Identity;
}

export async function verifyAccessToken(
  token: string,
  key: JWTVerifyGetKey,
  issuer: string,
  algorithm: string,
): Promise<string> {
  if (!['ES256', 'RS256'].includes(algorithm))
    throw new Error('Asymmetric signing algorithm required');
  const { jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience: 'authenticated',
    algorithms: [algorithm],
    requiredClaims: ['sub', 'exp', 'iat', 'role'],
  });
  if (
    payload.role !== 'authenticated' ||
    payload.is_anonymous === true ||
    !payload.sub ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.sub,
    )
  ) {
    throw new Error('User access token required');
  }
  return payload.sub;
}

@Injectable()
export class AuthService {
  private keys?: JWTVerifyGetKey;
  constructor(private readonly config: ConfigService) {}
  async authenticate(token: string): Promise<Identity> {
    const project = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const algorithm = this.config.get<string>('SUPABASE_JWT_ALGORITHM');
    if (!project || !algorithm || !['ES256', 'RS256'].includes(algorithm)) {
      throw new ServiceUnavailableException(
        'Asymmetric Supabase authentication is not configured',
      );
    }
    try {
      const { createRemoteJWKSet } = await import('jose');
      const issuer = `${project}/auth/v1`;
      this.keys ??= createRemoteJWKSet(
        new URL(`${issuer}/.well-known/jwks.json`),
        {
          cacheMaxAge: 600_000,
          cooldownDuration: 30_000,
          timeoutDuration: 5000,
        },
      );
      return {
        userId: await verifyAccessToken(token, this.keys, issuer, algorithm),
        token,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
  async verifiedEmail(identity: Identity): Promise<string> {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    if (!url || !key)
      throw new ServiceUnavailableException('Supabase is not configured');
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser(identity.token);
      if (error && (!error.status || error.status >= 500)) {
        throw new ServiceUnavailableException(
          'Unable to verify your email. Please retry.',
        );
      }
      if (
        error ||
        data.user?.id !== identity.userId ||
        !data.user.email ||
        !data.user.email_confirmed_at
      ) {
        throw new UnauthorizedException('A verified email is required');
      }
      return data.user.email.trim().toLowerCase();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException(
        'Unable to verify your email. Please retry.',
      );
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/.exec(request.headers.authorization ?? '');
    if (!match?.[1]) throw new UnauthorizedException('Sign in to continue');
    request.identity = await this.auth.authenticate(match[1]);
    return true;
  }
}
