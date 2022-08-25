import { serve } from 'https://deno.land/std@0.114.0/http/server.ts';
import * as postgres from 'https://deno.land/x/postgres@v0.14.2/mod.ts';

// Get the connection string from the environment variable "DATABASE_URL"
const databaseUrl = Deno.env.get('DATABASE_URL')!;

// Create a database pool with three connections that are lazily established
const pool = new postgres.Pool(databaseUrl, 3, true);

// Connect to the database
const connection = await pool.connect();
try {
  // Create the table
  await connection.queryObject`
    CREATE TABLE IF NOT EXISTS nftMetaDatas (
      tokenId INTEGER AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL
    )
  `;
  await connection.queryObject`
    CREATE TABLE IF NOT EXISTS nftPersonalDatas (
      id INTEGER AS IDENTITY PRIMARY KEY,
      tokenId INTEGER REFERENCES nftMetaDatas(tokenId),
      level INTEGER NOT NULL,
      damages INTEGER[][2] NOT NULL,
      HP FLOAT8 NOT NULL
    )
  `;
} finally {
  // Release the connection back into the pool
  connection.release();
}

serve(async (req) => {
  const url = new URL(req.url);
  const connection = await pool.connect();

  try {
    switch (url.pathname) {
      case '/metaData': {
        switch (req.method) {
          case 'GET': {
            const nftMetaDatas = await connection.queryObject`
              SELECT * FROM nftMetaDatas
            `;
            const body = JSON.stringify(nftMetaDatas.rows, null, 2);
            return new Response(body, {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          case 'POST': {
            const params = await req.json().catch(() => null);
            if (params !== null) {
              await connection.queryObject`
                INSERT INTO nftMetaDatas (name ,description, image, HP) VALUES (${params.name}, ${params.description}, ${params.image}, ${params.HP})
              `;
            } else {
              return new Response('Internal Server Error', { status: 500 });
            }
            return new Response('Not Found', { status: 404 });
          }
          default: {
            return new Response('Not Found', { status: 404 });
          }
        }
      }
      default: {
        return new Response('not Found', { status: 404 });
      }
    }
  } catch {
    return new Response('Internal Server Error', {
      status: 500,
    });
  } finally {
    connection.release();
  }
});