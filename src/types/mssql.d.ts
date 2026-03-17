declare module "mssql" {
  export type config = {
    server: string;
    database?: string;
    authentication?: {
      type: string;
      options?: {
        token?: string;
      };
    };
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
      connectTimeout?: number;
      requestTimeout?: number;
    };
    pool?: {
      max?: number;
      min?: number;
      idleTimeoutMillis?: number;
    };
  };

  export class ConnectionPool {
    constructor(config: config);
    connect(): Promise<ConnectionPool>;
    request(): {
      query<T extends Record<string, unknown> = Record<string, unknown>>(
        statement: string,
      ): Promise<{ recordset: T[] }>;
    };
  }

  const sql: {
    ConnectionPool: typeof ConnectionPool;
  };

  export default sql;
}
