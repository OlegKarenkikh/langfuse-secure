import type { QueryResult } from '../../driver/database-connection.js';
import type { RootOperationNode } from '../../query-compiler/query-compiler.js';
import type { UnknownRow } from '../../util/type-utils.js';
import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs } from '../kysely-plugin.js';
/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
export declare class ImmediateValuePlugin implements KyselyPlugin {
    #private;
    transformQuery(args: PluginTransformQueryArgs): RootOperationNode;
    transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>>;
}
