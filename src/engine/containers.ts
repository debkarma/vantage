import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ContainerConfig } from './config.js';
import path from 'path';

export interface ContainerState {
  container: StartedMongoDBContainer | StartedPostgreSqlContainer;
  envVar: string;
  connectionString: string;
}

let globalContainers: ContainerState[] = [];

// Ensure we clean up containers on Ctrl+C
process.on('SIGINT', async () => {
  if (globalContainers.length > 0) {
    console.log('\n[Vantage] Caught SIGINT, cleaning up ephemeral containers...');
    await stopContainers(globalContainers);
  }
  process.exit(1);
});

export async function startContainers(configs: ContainerConfig[]): Promise<ContainerState[]> {
  const states: ContainerState[] = [];
  
  for (const config of configs) {
    if (config.type === 'mongodb') {
      let container = new MongoDBContainer(config.image || 'mongo:6.0');
      
      if (config.seed) {
        const seedPath = path.resolve(process.cwd(), config.seed);
        const fileName = path.basename(seedPath);
        // MongoDB official Docker image executes .js or .sh files found in this directory sequentially
        container = container.withBindMounts([{
          source: seedPath,
          target: `/docker-entrypoint-initdb.d/${fileName}`
        }]);
      }

      // MongoDBContainer from @testcontainers/mongodb handles readiness checks internally!
      const started = await container.start();

      // Mongoose/MongoDB Node Driver attempts topology discovery which returns the internal docker container ID.
      // Appending ?directConnection=true forces the driver to connect to the mapped localhost port directly.
      const rawUri = started.getConnectionString();
      const connectionString = rawUri.includes('?') ? `${rawUri}&directConnection=true` : `${rawUri}/?directConnection=true`;

      states.push({
        container: started,
        envVar: config.env_var,
        connectionString,
      });
    } else if (config.type === 'postgresql') {
      let container = new PostgreSqlContainer(config.image || 'postgres:15');
      
      if (config.seed) {
        const seedPath = path.resolve(process.cwd(), config.seed);
        const fileName = path.basename(seedPath);
        container = container.withBindMounts([{
          source: seedPath,
          target: `/docker-entrypoint-initdb.d/${fileName}`
        }]);
      }

      const started = await container.start();
      // SQLAlchemy requires 'postgresql://' instead of 'postgres://'
      const connectionString = started.getConnectionUri().replace(/^postgres:\/\//, 'postgresql://');

      states.push({
        container: started,
        envVar: config.env_var,
        connectionString,
      });
    } else {
      throw new Error(`Unsupported container type: ${config.type}. Supported types: mongodb, postgresql`);
    }
  }

  globalContainers = globalContainers.concat(states);
  return states;
}

export async function stopContainers(states: ContainerState[]) {
  for (const state of states) {
    try {
      await state.container.stop();
    } catch (e) {
      console.error(`[Vantage] Failed to stop container:`, e);
    }
  }
  // Remove stopped containers from global tracking
  globalContainers = globalContainers.filter(c => !states.includes(c));
}
