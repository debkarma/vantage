import { PostgreSqlContainer } from "@testcontainers/postgresql";

async function run() {
  const container = await new PostgreSqlContainer("postgres:15").start();
  console.log("URI:", container.getConnectionUri());
  await container.stop();
}

run().catch(console.error);
