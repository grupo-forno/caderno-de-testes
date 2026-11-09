import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
// o driver aceita um comando por vez; o schema só tem "create table", sem ";" dentro de texto
for (const cmd of readFileSync("db/schema.sql", "utf8").split(";")) {
  if (cmd.replace(/--.*$/gm, "").trim()) await sql.query(cmd);
}
console.log("Banco pronto.");
