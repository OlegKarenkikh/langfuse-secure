import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const SelectAllNode = freeze({
    is(node) {
        return node.kind === 'SelectAllNode';
    },
    create() {
        return freeze({
            kind: 'SelectAllNode',
        });
    },
});
