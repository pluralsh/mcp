import express from 'express';
import type { Request, Response} from 'express';

import { authenticateJWT } from "./auth.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});


const app = express();

const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get("/sse", authenticateJWT, async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  console.log(transport.sessionId);
  await server.connect(transport);
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

console.log("Creating MCP Server on port 3000")
app.listen(3000);
