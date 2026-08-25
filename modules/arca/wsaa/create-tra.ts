export function createTra(service: string, now = new Date()) {
  const generation = new Date(now.getTime() - 60_000).toISOString();
  const expiration = new Date(
    now.getTime() + 10 * 60 * 60 * 1000,
  ).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${uniqueId}</uniqueId><generationTime>${generation}</generationTime><expirationTime>${expiration}</expirationTime></header><service>${service}</service></loginTicketRequest>`;
}
