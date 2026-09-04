import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { CgwSubscriber } from '../entities/cgw-subscriber.entity';
import { verifyCgwToken } from '../cgw/cgw-token.util';

@Injectable()
export class CgwJwtGuard implements CanActivate {
  constructor(
    @InjectRepository(CgwSubscriber)
    private readonly subscriberRepo: Repository<CgwSubscriber>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: CgwSubscriber }
    >();
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        success: false,
        code: 'TOKEN_REQUIRED',
        message: 'Not authorized, no token',
      });
    }

    const token = header.slice(7).trim();
    const payload = verifyCgwToken(token, process.env.JWT_SECRET || '');
    if (!payload) {
      throw new UnauthorizedException({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Not authorized, token failed',
      });
    }

    const user = await this.subscriberRepo.findOne({ where: { id: payload.id } });
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Session user no longer exists. Please subscribe again.',
      });
    }

    req.user = user;
    return true;
  }
}
