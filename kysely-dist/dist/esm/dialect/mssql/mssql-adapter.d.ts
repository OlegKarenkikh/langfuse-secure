import type { Kysely } from '../../kysely.js';
import { DialectAdapterBase } from '../dialect-adapter-base.js';
export declare class MssqlAdapter extends DialectAdapterBase {
    get supportsCreateIfNotExists(): boolean;
    get supportsTransactionalDdl(): boolean;
    get supportsOutput(): boolean;
    acquireMigrationLock(db: Kysely<any>): Promise<void>;
    releaseMigrationLock(): Promise<void>;
}
