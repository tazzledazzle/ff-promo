-- Second database for Kotlin/Flyway-only dev (avoids Prisma migration history conflicts).
SELECT 'CREATE DATABASE ffpromo_kotlin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ffpromo_kotlin')\gexec
GRANT ALL PRIVILEGES ON DATABASE ffpromo_kotlin TO ffpromo;
