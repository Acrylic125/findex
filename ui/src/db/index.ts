import { env } from "@/lib/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const client = postgres(env.DATABASE_URL, { prepare: false });
export const db = drizzle(client);
