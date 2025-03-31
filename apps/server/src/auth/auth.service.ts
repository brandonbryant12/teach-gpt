import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PG_CONNECTION } from '../db/drizzle.constants';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema'; // Adjust path as needed
import { eq } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_CONNECTION) private db: PostgresJsDatabase<typeof schema>,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<typeof schema.users.$inferSelect, 'passwordHash'> | null> {
    const usersResult = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (usersResult.length === 0) {
      return null;
    }

    const user = usersResult[0];
    const isPasswordMatching = await bcrypt.compare(pass, user.passwordHash);

    if (isPasswordMatching) {
      const { ...result } = user;
      return result;
    }

    return null;
  }

  login(user: Omit<typeof schema.users.$inferSelect, 'passwordHash'>) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
