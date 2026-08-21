#!/bin/sh
set -eu
echo "[vase] sincronizando esquema Prisma..."
npx prisma db push --accept-data-loss
if [ "${SEED_DATABASE:-false}" = "true" ]; then npm run db:seed; fi
exec npm run start
