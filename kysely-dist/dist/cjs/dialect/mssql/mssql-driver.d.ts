import type { DatabaseConnection, QueryResult } from '../../driver/database-connection.js';
import type { Driver, TransactionSettings } from '../../driver/driver.js';
import type { MssqlDialectConfig, Tedious, TediousConnection } from './mssql-dialect-config.js';
import { CompiledQuery } from '../../query-compiler/compiled-query.js';
declare const PRIVATE_RESET_METHOD: unique symbol;
declare const PRIVATE_DESTROY_METHOD: unique symbol;
declare const PRIVATE_VALIDATE_METHOD: unique symbol;
export declare class MssqlDriver implements Driver {
    #private;
    constructor(config: MssqlDialectConfig);
    init(): Promise<void>;
    acquireConnection(): Promise<DatabaseConnection>;
    beginTransaction(connection: MssqlConnection, settings: TransactionSettings): Promise<void>;
    commitTransaction(connection: MssqlConnection): Promise<void>;
    rollbackTransaction(connection: MssqlConnection): Promise<void>;
    savepoint(connection: MssqlConnection, savepointName: string): Promise<void>;
    rollbackToSavepoint(connection: MssqlConnection, savepointName: string): Promise<void>;
    releaseConnection(connection: MssqlConnection): Promise<void>;
    destroy(): Promise<void>;
}
declare class MssqlConnection implements DatabaseConnection {
    #private;
    constructor(connection: TediousConnection, tedious: Tedious);
    beginTransaction(settings: TransactionSettings): Promise<void>;
    commitTransaction(): Promise<void>;
    connect(): Promise<this>;
    executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>>;
    rollbackTransaction(savepointName?: string): Promise<void>;
    savepoint(savepointName: string): Promise<void>;
    streamQuery<O>(compiledQuery: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<O>>;
    [PRIVATE_DESTROY_METHOD](): Promise<void>;
    [PRIVATE_RESET_METHOD](): Promise<void>;
    [PRIVATE_VALIDATE_METHOD](): Promise<boolean>;
}
export {};
