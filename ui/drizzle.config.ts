import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts", // Path to your schema files
  out: "./drizzle", // Output directory for migration files
  dialect: "postgresql", // Specify the SQL dialect
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Database connection URL from environment variables
  },
});
