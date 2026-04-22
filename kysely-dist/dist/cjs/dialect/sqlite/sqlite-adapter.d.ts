import type { Kysely } from '../../kysely.js';
import { DialectAdapterBase } from '../dialect-adapter-base.js';
import type { MigrationLockOptions } from '../dialect-adapter.js';
export declare class SqliteAdapter extends DialectAdapterBase {
    get supportsTransactionalDdl(): boolean;
    get supportsReturning(): boolean;
    acquireMigrationLock(_db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
    releaseMigrationLock(_db: Kysely<any>, _opt: MigrationLockOptions): Promise<void>;
}
