#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureSignedIn, AppAccessDeniedError } from './auth/login.js';
import { FirebaseClientTripRepository } from './repository/FirebaseClientTripRepository.js';
import { registerTools } from './tools/index.js';

async function main(): Promise<void> {
  let auth;
  try {
    auth = await ensureSignedIn();
  } catch (err) {
    if (err instanceof AppAccessDeniedError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const repo = new FirebaseClientTripRepository(auth);
  const server = new McpServer({ name: 'japan-companion-mcp', version: '0.1.0' });
  registerTools(server, repo);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('japan-companion-mcp ready — signed in as', auth.currentUser?.email);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
