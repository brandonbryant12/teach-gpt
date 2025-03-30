import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { PG_CONNECTION } from '../db/drizzle.constants';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

export type User = Omit<typeof schema.users.$inferSelect, 'passwordHash'>;
export type CreateUserDto = Omit<
  typeof schema.users.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'passwordHash'
> & { password: string };

@Injectable()
export class UserService {
  constructor(
    @Inject(PG_CONNECTION) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findOneByEmail(
    email: string,
  ): Promise<typeof schema.users.$inferSelect | undefined> {
    const usersResult = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    return usersResult[0];
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.findOneByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    const newUser = {
      email: createUserDto.email,
      passwordHash: hashedPassword,
      // Drizzle handles default timestamps
    };

    const insertedUsers = await this.db
      .insert(schema.users)
      .values(newUser)
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      });

    if (insertedUsers.length === 0) {
      throw new Error('User creation failed after insert.');
    }

    return insertedUsers[0];
  }
}
