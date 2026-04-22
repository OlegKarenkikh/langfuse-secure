import type { DatabaseConnection } from './database-connection.js';
import type { ConnectionProvider } from './connection-provider.js';
export declare class SingleConnectionProvider implements ConnectionProvider {
    #private;
    constructor(connection: DatabaseConnection);
    provideConnection<T>(consumer: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
}
