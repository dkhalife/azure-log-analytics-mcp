# Azure Log Analytics MCP

**Query Azure Log Analytics workspaces from any MCP client**

Azure Log Analytics MCP is a lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that lets AI assistants query your Azure Log Analytics workspaces. It runs locally via stdio and authenticates using your existing Azure credentials.

> **Tip:** If your Application Insights resource is workspace-based (the default since February 2024), you can use this server to query App Insights data too. See [App Insights vs Log Analytics tables](#app-insights-vs-log-analytics-tables) for details.

## 🎯 What it does

This MCP server gives AI assistants read-only access to your Log Analytics telemetry data through two simple tools:

* **Discover** what tables are available in your workspace
* **Query** your telemetry using [KQL (Kusto Query Language)](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)

All operations are strictly read-only — KQL is a query language, not a mutation language.

## ✨ Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_tables` | Discovers available tables in the workspace by scanning recent data | `timespan` (optional) — ISO 8601 duration, defaults to `P1D` |
| `query` | Runs a KQL query and returns results as JSON | `query` (required) — KQL query string; `timespan` (optional) — ISO 8601 duration, defaults to `P1D` |

## 🚀 Installation

### Prerequisites

* [Node.js](https://nodejs.org) 18+
* An Azure account with access to a Log Analytics workspace
* Azure CLI logged in (`az login`) or another credential source supported by [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential)

### Setup

No build step required for end users. Just use `npx`:

```bash
APP_INSIGHTS_WORKSPACE_ID=<your-workspace-id> npx @dkhalife/azure-log-analytics-mcp
```

Or install globally:

```bash
npm install -g @dkhalife/azure-log-analytics-mcp
```

For development:

```bash
git clone https://github.com/dkhalife/azure-log-analytics-mcp.git
cd azure-log-analytics-mcp
npm install
npm run build
```

## ⚙️ Configuration

The server is configured via a single environment variable:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_INSIGHTS_WORKSPACE_ID` | ✅ | The Log Analytics workspace ID (GUID) |

### Finding your Workspace ID

**Azure Portal:**
1. Go to your **Log Analytics workspace** → **Overview**
2. Copy the **Workspace ID** (a GUID)

**Azure CLI:**
```bash
az monitor log-analytics workspace show \
  --workspace-name <workspace-name> \
  -g <resource-group> \
  --query "customerId" -o tsv
```

### Authentication

The server uses [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential) which automatically picks up credentials from (in order):

1. Environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`)
2. Azure CLI (`az login`)
3. Azure PowerShell
4. Managed Identity (when running in Azure)

For local development, `az login` is the simplest option.

## 📋 Usage Examples

### VS Code

Add to your VS Code `settings.json` under MCP servers:

```json
{
  "mcp": {
    "servers": {
      "log-analytics": {
        "command": "npx",
        "args": ["@dkhalife/azure-log-analytics-mcp"],
        "env": {
          "APP_INSIGHTS_WORKSPACE_ID": "<your-workspace-id>"
        }
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "log-analytics": {
      "command": "npx",
      "args": ["@dkhalife/azure-log-analytics-mcp"],
      "env": {
        "APP_INSIGHTS_WORKSPACE_ID": "<your-workspace-id>"
      }
    }
  }
}
```

### Example Prompts

Once connected, you can ask your AI assistant things like:

* *"List all available tables in the workspace"*
* *"Show me recent security events from the last hour"*
* *"Query heartbeat data for the last 7 days grouped by computer"*
* *"What are the top error events in the last 24 hours?"*

### Example KQL Queries

```kusto
// Recent heartbeats by computer
Heartbeat
| summarize LastHeartbeat = max(TimeGenerated) by Computer
| order by LastHeartbeat desc

// Security events by type
SecurityEvent
| summarize count() by Activity
| top 10 by count_

// Performance counters — average CPU usage
Perf
| where CounterName == "% Processor Time"
| summarize avg(CounterValue) by Computer, bin(TimeGenerated, 1h)
| order by TimeGenerated desc

// Syslog errors
Syslog
| where SeverityLevel == "err"
| summarize count() by Facility, bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

## 📊 App Insights vs Log Analytics Tables

If your Application Insights resource is linked to a Log Analytics workspace, you can query App Insights data through this server. However, the table names differ between the two:

| Log Analytics Table | Application Insights Table | Description |
|---------------------|---------------------------|-------------|
| `AppRequests` | `requests` | Incoming HTTP requests |
| `AppDependencies` | `dependencies` | Outbound dependency calls |
| `AppExceptions` | `exceptions` | Application exceptions |
| `AppTraces` | `traces` | Log traces |
| `AppEvents` | `customEvents` | Custom events |
| `AppMetrics` | `customMetrics` | Custom metrics |
| `AppPageViews` | `pageViews` | Page view telemetry |
| `AppBrowserTimings` | `browserTimings` | Browser performance |
| `AppAvailabilityResults` | `availabilityResults` | Availability tests |
| `AppPerformanceCounters` | `performanceCounters` | Performance counters |

When querying through this MCP server (which connects to the Log Analytics workspace), use the **Log Analytics table names** (left column).

## ❓ FAQ

**Q: Does it work with Application Insights?**
Yes, if your Application Insights resource is workspace-based (the default since February 2024). The App Insights data appears in the Log Analytics workspace under table names like `AppRequests`, `AppExceptions`, etc. See [App Insights vs Log Analytics Tables](#app-insights-vs-log-analytics-tables).

**Q: What authentication methods are supported?**
Any method supported by Azure's [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential) — Azure CLI, environment variables, managed identity, and more. For local use, `az login` is the easiest.

**Q: What is the `timespan` parameter?**
An ISO 8601 duration string that limits how far back the query looks. Examples: `PT1H` (1 hour), `P1D` (1 day), `P7D` (7 days), `P30D` (30 days). Defaults to `P1D` (24 hours) if not specified.

**Q: Can I query multiple workspaces?**
Not currently. The server queries the single workspace specified by `APP_INSIGHTS_WORKSPACE_ID`.

**Q: Why do I get "The requested path does not exist"?**
Your `APP_INSIGHTS_WORKSPACE_ID` is incorrect. Make sure you're using the **Workspace ID** (a GUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), not the workspace name or ARM resource ID. See [Finding your Workspace ID](#finding-your-workspace-id).

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repo and submit pull requests.
If you have ideas but aren't familiar with code, you can also [open issues](https://github.com/dkhalife/azure-log-analytics-mcp/issues).

## 🔒 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
