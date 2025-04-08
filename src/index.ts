import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import type { Request, Response} from 'express';
import { z } from "zod";


import { authenticateJWT, initializeJWKS } from "./auth.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

await initializeJWKS();

const server = new McpServer({
  name: "Echo",
  version: "1.0.0"
});

server.resource(
  "echo",
  new ResourceTemplate("echo://{message}", { list: undefined }),
  async (uri, { message }) => ({
    contents: [{
      uri: uri.href,
      text: `Resource echo: ${message}`
    }]
  })
);

server.tool(
  "echo",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ type: "text", text: `Tool echo: ${message}` }]
  })
);

server.prompt(
  "echo",
  { message: z.string() },
  ({ message }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please process this message: ${message}`
      }
    }]
  })
);

const app = express();

const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get("/sse", authenticateJWT, async (_: Request, res: Response) => {
  try {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
      delete transports[transport.sessionId];
    });
    console.error("Starting MCP server.connect with session:", transport.sessionId);
    await server.connect(transport);
    console.error("MCP connection complete for session:", transport.sessionId);
  } catch (err) {
    console.error("Error during server.connect:", err);
    res.status(500).send("Internal server error");
  }
});

app.post("/messages", authenticateJWT, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

console.error("Creating MCP Server on port 3000")
app.listen(3000);
