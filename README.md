# Echo MCP Server

This is an [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that demonstrates how to expose resources, tools, and prompt templates to Claude or any MCP-compliant client. It supports SSE as opposed to stdio.

## Features

- 🧪 **Resource handler**: Returns a text document based on the URI (`echo://message`)
- 🛠 **Tool handler**: Responds to structured tool calls with text output
- 💬 **Prompt handler**: Generates prompt messages for Claude to respond to

