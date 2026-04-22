import type { CompiledQuery } from '../query-compiler/compiled-query.js';
import type { KyselyPlugin } from '../plugin/kysely-plugin.js';
import type { DialectAdapter } from '../dialect/dialect-adapter.js';
import { QueryExecutorBase } from './query-executor-base.js';
/**
 * A {@link QueryExecutor} subclass that can be used when you don't
 * have a {@link QueryCompiler}, {@link ConnectionProvider} or any
 * other needed things to actually execute queries.
 */
export declare class NoopQueryExecutor extends QueryExecutorBase {
    get adapter(): DialectAdapter;
    compileQuery(): CompiledQuery;
    provideConnection<T>(): Promise<T>;
    withConnectionProvider(): NoopQueryExecutor;
    withPlugin(plugin: KyselyPlugin): NoopQueryExecutor;
    withPlugins(plugins: ReadonlyArray<KyselyPlugin>): NoopQueryExecutor;
    withPluginAtFront(plugin: KyselyPlugin): NoopQueryExecutor;
    withoutPlugins(): NoopQueryExecutor;
}
export declare const NOOP_QUERY_EXECUTOR: NoopQueryExecutor;
