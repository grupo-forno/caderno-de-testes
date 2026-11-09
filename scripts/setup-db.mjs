import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql.query(readFileSync("db/schema.sql", "utf8"));
console.log("Banco pronto.");
