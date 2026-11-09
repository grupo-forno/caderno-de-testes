// os prints só valem se estiverem na NOSSA loja de arquivos (o id dela vem de BLOB_STORE_ID)
const LOJA = (process.env.BLOB_STORE_ID ?? "").replace(/^store_/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const URL_ANEXO = LOJA ? new RegExp(`^https://${LOJA}\\.public\\.blob\\.vercel-storage\\.com/`, "i") : /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;
export const MAX_PRINTS = 10;
