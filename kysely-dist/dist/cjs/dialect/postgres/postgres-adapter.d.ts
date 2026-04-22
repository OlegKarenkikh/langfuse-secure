import type { Kysely } from '../../kysely.js';
import { DialectAdapterBase } from '../dialect-adapter-base.js';
import type { MigrationLockOptions } from '../dialect-adapter.js';
export declare class PostgresAdapter extends DialectAdapterBase {
    get supportsTransactionalDdl(): boolean;
    get supportsReturning(): boolean;
    acquireMigrationLock(db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
    releaseMigrationLock(_db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
}
