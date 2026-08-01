import postgres, { type Sql } from "postgres";

type BoundValue = string | number | boolean | null | Uint8Array;

type D1LikeResult = {
  success: true;
  results: Record<string, unknown>[];
  meta: { changes: number };
};

function postgresPlaceholders(query: string) {
  let result = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const next = query[index + 1];

    if (quote) {
      result += character;
      if (character === quote && next === quote) {
        result += next;
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }

    if (character === "?") {
      parameter += 1;
      result += `$${parameter}`;
      continue;
    }

    result += character;
  }

  return result.replace(
    /\bDEFAULT\s+CURRENT_TIMESTAMP\b/gi,
    "DEFAULT (CURRENT_TIMESTAMP::text)",
  );
}

class PostgresPreparedStatement {
  readonly query: string;
  readonly values: BoundValue[];
  private readonly client: Sql;

  constructor(client: Sql, query: string, values: BoundValue[] = []) {
    this.client = client;
    this.query = query;
    this.values = values;
  }

  bind(...values: BoundValue[]) {
    return new PostgresPreparedStatement(this.client, this.query, values);
  }

  private async execute(client: Sql = this.client) {
    return client.unsafe<Record<string, unknown>[]>(
      postgresPlaceholders(this.query),
      this.values,
    );
  }

  async all<T = Record<string, unknown>>() {
    const rows = await this.execute();
    return {
      success: true as const,
      results: rows as T[],
      meta: { changes: rows.count ?? 0 },
    };
  }

  async first<T = Record<string, unknown>>(column?: string) {
    const rows = await this.execute();
    const row = rows[0] as T | undefined;
    if (!row || !column) return row ?? null;
    return (row as Record<string, unknown>)[column] ?? null;
  }

  async raw<T extends unknown[] = unknown[]>() {
    const rows = await this.execute();
    return rows.map((row) => Object.values(row)) as T[];
  }

  async run(): Promise<D1LikeResult> {
    const rows = await this.execute();
    return {
      success: true,
      results: rows,
      meta: { changes: rows.count ?? 0 },
    };
  }

  async executeWith(client: Sql): Promise<D1LikeResult> {
    const rows = await this.execute(client);
    return {
      success: true,
      results: rows,
      meta: { changes: rows.count ?? 0 },
    };
  }
}

class PostgresD1Database {
  readonly __postgresCompat = true;
  private readonly client: Sql;

  constructor(connectionString: string) {
    this.client = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  prepare(query: string) {
    return new PostgresPreparedStatement(this.client, query);
  }

  async batch(statements: PostgresPreparedStatement[]) {
    return this.client.begin(async (transaction) => {
      const results: D1LikeResult[] = [];
      for (const statement of statements) {
        results.push(await statement.executeWith(transaction));
      }
      return results;
    });
  }

  async exec(query: string) {
    const rows = await this.client.unsafe<Record<string, unknown>[]>(query);
    return { count: rows.count ?? 0, duration: 0 };
  }
}

let cachedDatabase: D1Database | null = null;

export function getPostgresD1Database(connectionString: string): D1Database {
  cachedDatabase ??= new PostgresD1Database(connectionString) as unknown as D1Database;
  return cachedDatabase;
}

export function isPostgresD1Database(value: D1Database) {
  return Boolean(
    (value as D1Database & { __postgresCompat?: boolean }).__postgresCompat,
  );
}
