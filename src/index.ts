#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DefaultAzureCredential } from "@azure/identity";
import {
  LogsQueryClient,
  LogsQueryResultStatus,
  LogsTable,
} from "@azure/monitor-query";
import { z } from "zod";

const workspaceId = process.env.APP_INSIGHTS_WORKSPACE_ID;
if (!workspaceId) {
  console.error("APP_INSIGHTS_WORKSPACE_ID environment variable is required");
  process.exit(1);
}

const credential = new DefaultAzureCredential();
const logsClient = new LogsQueryClient(credential);

function formatTable(table: LogsTable): string {
  const columns = table.columnDescriptors.map((c) => c.name);
  const rows = table.rows.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
  return JSON.stringify(rows, null, 2);
}

const server = new McpServer({
  name: "azure-log-analytics-mcp",
  version: "1.0.0",
});

server.tool(
  "list_tables",
  "List available tables in the Application Insights workspace",
  {
    timespan: z
      .string()
      .optional()
      .describe(
        "ISO 8601 duration for the query timespan (default: PT24H — last 24 hours)"
      ),
  },
  async ({ timespan }) => {
    try {
      const duration = timespan ?? "P1D";
      const query =
        "search * | distinct $table | sort by $table asc";

      const result = await logsClient.queryWorkspace(workspaceId, query, {
        duration,
      });

      if (result.status === LogsQueryResultStatus.PartialFailure) {
        return {
          content: [
            {
              type: "text",
              text: `Query partially failed: ${result.partialError?.message ?? "unknown error"}`,
            },
          ],
          isError: true,
        };
      }

      const tables =
        result.tables[0]?.rows.map((row) => String(row[0])) ?? [];
      return {
        content: [
          {
            type: "text",
            text:
              tables.length > 0
                ? `Available tables:\n${tables.map((t: string) => `  - ${t}`).join("\n")}`
                : "No tables found in the specified timespan.",
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error listing tables: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "query",
  "Run a read-only KQL query against the Application Insights workspace",
  {
    query: z.string().describe("The KQL query to execute"),
    timespan: z
      .string()
      .optional()
      .describe(
        "ISO 8601 duration for the query timespan (default: PT24H — last 24 hours)"
      ),
  },
  async ({ query, timespan }) => {
    try {
      const duration = timespan ?? "P1D";

      const result = await logsClient.queryWorkspace(workspaceId, query, {
        duration,
      });

      if (result.status === LogsQueryResultStatus.PartialFailure) {
        return {
          content: [
            {
              type: "text",
              text: `Query partially failed: ${result.partialError?.message ?? "unknown error"}`,
            },
          ],
          isError: true,
        };
      }

      const output = result.tables.map((table: LogsTable) => formatTable(table)).join("\n");
      return {
        content: [
          {
            type: "text",
            text: output || "Query returned no results.",
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error running query: ${message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
