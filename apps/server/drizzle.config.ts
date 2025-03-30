import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' }); // Load environment variables

export default defineConfig({
  dialect: 'postgresql', // "mysql" | "sqlite" | "postgresql"
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    // Ensure environment variables are loaded
    // You might need to adjust based on your .env file or environment
    url: process.env.DATABASE_URL!,
  },
  // Print schema changes to console
  verbose: true,
  // Always ask for confirmation
  strict: true,
});
