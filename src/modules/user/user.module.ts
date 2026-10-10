import { Module } from '@nestjs/common';
import { UserService } from './providers/user.service.js';
import { UserController } from './user.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
