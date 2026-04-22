import { isFunction, isObject } from '../util/object-utils.js';
export function isOperationNodeSource(obj) {
    return isObject(obj) && isFunction(obj.toOperationNode);
}
