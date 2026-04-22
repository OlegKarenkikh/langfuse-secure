import type { Driver } from '../../driver/driver.js';
import type { Kysely } from '../../kysely.js';
import type { QueryCompiler } from '../../query-compiler/query-compiler.js';
import type { Dialect } from '../dialect.js';
import type { DatabaseIntrospector } from '../database-introspector.js';
import type { DialectAdapter } from '../dialect-adapter.js';
import type { PostgresDialectConfig } from './postgres-dialect-config.js';
/**
 * PostgreSQL dialect that uses the [pg](https://node-postgres.com/) library.
 *
 * The constructor takes an instance of {@link PostgresDialectConfig}.
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `pool`
 * can be a function:
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: async () => new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 */
export declare class PostgresDialect implements Dialect {
    #private;
    constructor(config: PostgresDialectConfig);
    createDriver(): Driver;
    createQueryCompiler(): QueryCompiler;
    createAdapter(): DialectAdapter;
    createIntrospector(db: Kysely<any>): DatabaseIntrospector;
}
