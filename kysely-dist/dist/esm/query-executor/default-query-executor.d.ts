import type { ConnectionProvider } from '../driver/connection-provider.js';
import type { DatabaseConnection } from '../driver/database-connection.js';
import type { CompiledQuery } from '../query-compiler/compiled-query.js';
import type { RootOperationNode, QueryCompiler } from '../query-compiler/query-compiler.js';
import type { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { QueryExecutorBase } from './query-executor-base.js';
import type { DialectAdapter } from '../dialect/dialect-adapter.js';
import type { QueryId } from '../util/query-id.js';
export declare class DefaultQueryExecutor extends QueryExecutorBase {
    #private;
    constructor(compiler: QueryCompiler, adapter: DialectAdapter, connectionProvider: ConnectionProvider, plugins?: KyselyPlugin[]);
    get adapter(): DialectAdapter;
    compileQuery(node: RootOperationNode, queryId: QueryId): CompiledQuery;
    provideConnection<T>(consumer: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
    withPlugins(plugins: ReadonlyArray<KyselyPlugin>): DefaultQueryExecutor;
    withPlugin(plugin: KyselyPlugin): DefaultQueryExecutor;
    withPluginAtFront(plugin: KyselyPlugin): DefaultQueryExecutor;
    withConnectionProvider(connectionProvider: ConnectionProvider): DefaultQueryExecutor;
    withoutPlugins(): DefaultQueryExecutor;
}
