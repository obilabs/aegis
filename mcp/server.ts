/**
 * Aegis ITSM - MCP Server
 *
 * Model Context Protocol server for AI integration.
 * Provides tools for tickets, assets, knowledge base, and contacts.
 *
 * Usage:
 *   npx ts-node mcp/server.ts
 *
 * Or add to Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "aegis": {
 *         "command": "npx",
 *         "args": ["ts-node", "/path/to/aegis/mcp/server.ts"],
 *         "env": {
 *           "DATABASE_URL": "postgresql://user:pass@localhost:5432/aegis"
 *         }
 *       }
 *     }
 *   }
 */

import { Pool } from 'pg'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { createKBTools } from './tools/knowledge-base.js'
import { createTicketTools } from './tools/tickets.js'
import { createContactTools } from './tools/contacts.js'

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
})

const server = new Server(
  {
    name: 'aegis-itsm',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Combine all tools
const allTools: Record<string, any> = {
  'aegis.ping': {
    description: 'Test MCP connection to Aegis ITSM',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ status: 'ok', message: 'Aegis MCP server is running' }),
  },
  ...createKBTools(pool),
  ...createTicketTools(pool),
  ...createContactTools(pool),
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(allTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.parameters || { type: 'object', properties: {} },
    })),
  }
})

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const tool = allTools[name]
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`)
  }

  try {
    const result = await tool.execute(args || {})
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Aegis MCP server running on stdio')
  console.error(`Tools available: ${Object.keys(allTools).join(', ')}`)
}

main().catch(console.error)
