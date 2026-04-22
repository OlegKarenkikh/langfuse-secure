import type { QueryResult } from '../../driver/database-connection.js';
import type { RootOperationNode } from '../../query-compiler/query-compiler.js';
import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs } from '../kysely-plugin.js';
import type { UnknownRow } from '../../util/type-utils.js';
export declare class WithSchemaPlugin implements KyselyPlugin {
    #private;
    constructor(schema: string);
    transformQuery(args: PluginTransformQueryArgs): RootOperationNode;
    transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>>;
}
