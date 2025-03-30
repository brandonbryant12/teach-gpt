import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { PG_CONNECTION } from '../db/drizzle.constants';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema'; // Adjust path as needed
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_CONNECTION) private db: PostgresJsDatabase<typeof schema>,
    private userService: UserService, // We might need user service later
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
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
}
