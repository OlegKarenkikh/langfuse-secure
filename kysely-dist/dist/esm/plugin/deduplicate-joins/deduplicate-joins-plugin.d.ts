import type { QueryResult } from '../../driver/database-connection.js';
import type { RootOperationNode } from '../../query-compiler/query-compiler.js';
import type { UnknownRow } from '../../util/type-utils.js';
import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs } from '../kysely-plugin.js';
/**
 * Plugin that removes duplicate joins from queries.
 *
 * See [this recipe](https://github.com/kysely-org/kysely/blob/master/site/docs/recipes/0008-deduplicate-joins.md)
 */
export declare class DeduplicateJoinsPlugin implements KyselyPlugin {
    #private;
    transformQuery(args: PluginTransformQueryArgs): RootOperationNode;
    transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>>;
}
