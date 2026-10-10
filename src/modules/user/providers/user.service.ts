import { randomBytes, scrypt } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema/index.js';
import { user } from '../../../db/schema/user.js';
import { UserCreateDto } from '../dto/user-create.dto.js';
import { UserUpdateDto } from '../dto/user-update.dto.js';

const publicUserFields = {
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  imageUrl: user.imageUrl,
  isArchived: user.isArchived,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

@Injectable()
export class UserService {
  constructor(
    @Inject('DB')
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  

  findAll() {
    return this.db
      .select(publicUserFields)
      .from(user)
      .where(eq(user.isArchived, false));
  }

  async findOne(id: string) {
    const [foundUser] = await this.db
      .select(publicUserFields)
      .from(user)
      .where(and(eq(user.id, id), eq(user.isArchived, false)))
      .limit(1);

    if (!foundUser) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return foundUser;
  }

  async update(id: string, dto: UserUpdateDto) {
    const { password, ...fields } = dto;
    const values = {
      ...fields,
      ...(password === undefined ? {} : { password: await this.hashPassword(password) }),
      updatedAt: new Date(),
    };

    try {
      const [updatedUser] = await this.db
        .update(user)
        .set(values)
        .where(and(eq(user.id, id), eq(user.isArchived, false)))
        .returning(publicUserFields);

      if (!updatedUser) {
        throw new NotFoundException(`User ${id} not found`);
      }

      return updatedUser;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const [archivedUser] = await this.db
      .update(user)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(user.id, id), eq(user.isArchived, false)))
      .returning({ id: user.id });

    if (!archivedUser) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return { id: archivedUser.id, isArchived: true };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(key);
      });
    });
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
