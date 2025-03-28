#!/usr/bin/env node
import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import jwksClient from "jwks-rsa";
import jwtPkg from "jsonwebtoken";
type JwtPayload = jwtPkg.JwtPayload;


const JWT_AUTH_ENABLED = process.env.JWT_AUTH_ENABLED === "true";
const REQUIRED_GROUPS = process.env.REQUIRED_GROUPS?.split(",") ?? [];
const JWKS_URI = process.env.JWKS_URI || "https://your-console-url/.well-known/jwks.json";

const client = jwksClient({
    jwksUri: JWKS_URI,
});

async function verifyJwtMiddleware(req: http.IncomingMessage): Promise<JwtPayload> {
    const REQUIRED_GROUPS = process.env.REQUIRED_GROUPS?.split(",") ?? [];
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or invalid Authorization header");
    }

    const token = authHeader.substring(7); // remove "Bearer "
        
    const signingKeys = await client.getSigningKeys();
    if (signingKeys.length === 0) {
        throw new Error("No signing keys found in JWKS");
    }

    const publicKey = signingKeys[0].getPublicKey();

    return new Promise((resolve, reject) => {
        jwtPkg.verify(token, publicKey, { algorithms: ["ES256"] }, (err, decoded) => {
            if (err) return reject(err);

            if (typeof decoded !== "object" || decoded === null) {
                return reject(new Error("Invalid JWT payload"));
            }

            if (REQUIRED_GROUPS) {
                const groups = (decoded as any).groups;
              
                if (!Array.isArray(groups)) {
                  return reject(new Error("Missing 'groups' claim"));
                }
              
                if (!REQUIRED_GROUPS.some(group => groups.includes(group))) {
                    console.log("Decoded groups:", groups);
                    console.log("Required groups:", REQUIRED_GROUPS);
                    return reject(new Error("User does not belong to any required group"));
                }
            }
              
            resolve(decoded as JwtPayload);
        });
    });
}

async function main() {
    console.log("Starting MCP HTTP SERVER...")

    const server = new Server(
        { name: "MCP HTTP Server", version: "1.0.0" },
        { capabilities: { tools: {} } }
    );

    const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        if (req.method !== "GET") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
        }
    
        if (req.headers.accept !== "text/event-stream") {
            res.writeHead(406, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Only SSE transport is supported" }));
            return;
        }
    
        if (JWT_AUTH_ENABLED) {
            try {
                const user = await verifyJwtMiddleware(req);
                console.log("Authenticated SSE client:", user.sub);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized", details: message }));
                return;
            }
        }
    
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });
    
        res.write(`data: ${JSON.stringify({ message: "Connected to MCP SSE server" })}\n\n`);
    
        const interval = setInterval(() => {
            res.write(`data: ${JSON.stringify({ ping: new Date().toISOString() })}\n\n`);
        }, 15000);
    
        req.on("close", () => {
            clearInterval(interval);
            console.log("SSE connection closed");
        });
    };
        
    

    const httpServer = http.createServer(requestHandler);
    const PORT = process.env.PORT || 3000;

    httpServer.listen(PORT, () => {
        console.error(`MCP HTTP Server running on port ${PORT}`);
    });
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

export { verifyJwtMiddleware };
