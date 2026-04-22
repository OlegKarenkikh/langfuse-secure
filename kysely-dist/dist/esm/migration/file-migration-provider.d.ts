import type { Migration, MigrationProvider } from './migrator.js';
/**
 * Reads all migrations from a folder in node.js.
 *
 * ### Examples
 *
 * ```ts
 * import { promises as fs } from 'node:fs'
 * import path from 'node:path'
 *
 * new FileMigrationProvider({
 *   fs,
 *   path,
 *   migrationFolder: 'path/to/migrations/folder'
 * })
 * ```
 */
export declare class FileMigrationProvider implements MigrationProvider {
    #private;
    constructor(props: FileMigrationProviderProps);
    getMigrations(): Promise<Record<string, Migration>>;
}
export interface FileMigrationProviderFS {
    readdir(path: string): Promise<string[]>;
}
export interface FileMigrationProviderPath {
    join(...path: string[]): string;
}
export interface FileMigrationProviderProps {
    fs: FileMigrationProviderFS;
    path: FileMigrationProviderPath;
    migrationFolder: string;
}
