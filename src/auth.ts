import type { Request, Response, NextFunction } from 'express';
import jwksClient from "jwks-rsa";
import jwtPkg from "jsonwebtoken";


const JWT_AUTH_ENABLED = process.env.JWT_AUTH_ENABLED === "true";
const REQUIRED_GROUPS = process.env.REQUIRED_GROUPS?.split(",") ?? [];
const JWKS_URI = process.env.JWKS_URI || "https://your-console-url/.well-known/jwks.json";

const client = jwksClient({
    jwksUri: JWKS_URI,
});

const signingKeys = await client.getSigningKeys();
if (signingKeys.length === 0) {
    throw new Error("No signing keys found in JWKS");
}

const publicKey = signingKeys[0].getPublicKey();

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    if (!JWT_AUTH_ENABLED) {
        return next();
    }
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwtPkg.verify(token, publicKey, { algorithms: ["ES256"] });

        if (REQUIRED_GROUPS) {
            const groups = (decoded as any).groups;
            
            if (!Array.isArray(groups)) {
                return res.status(401).json({ message: "Missing 'groups' claim" });
            }
            
            if (!REQUIRED_GROUPS.some(group => groups.includes(group))) {
                console.log("Decoded groups:", groups);
                console.log("Required groups:", REQUIRED_GROUPS);
                return res.status(401).json({ message: "User does not belong to any required group" });
            }
        }
        (req as any).user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
