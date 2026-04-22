import type { DatabaseConnection } from '../../driver/database-connection.js';
import type { Driver } from '../../driver/driver.js';
import type { QueryCompiler } from '../../query-compiler/query-compiler.js';
import type { SqliteDialectConfig } from './sqlite-dialect-config.js';
export declare class SqliteDriver implements Driver {
    #private;
    constructor(config: SqliteDialectConfig);
    init(): Promise<void>;
    acquireConnection(): Promise<DatabaseConnection>;
    beginTransaction(connection: DatabaseConnection): Promise<void>;
    commitTransaction(connection: DatabaseConnection): Promise<void>;
    rollbackTransaction(connection: DatabaseConnection): Promise<void>;
    savepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    rollbackToSavepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    releaseSavepoint(connection: DatabaseConnection, savepointName: string, compileQuery: QueryCompiler['compileQuery']): Promise<void>;
    releaseConnection(): Promise<void>;
    destroy(): Promise<void>;
}
