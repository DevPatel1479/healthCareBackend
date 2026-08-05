import { verifyToken } from "../services/jwt.service.js";

export const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Authorization header missing
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required",
            });
        }

        // Expected format:
        // Authorization: Bearer <token>
        const [scheme, token] = authHeader.split(" ");

        // Invalid Authorization header format
        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization header format",
            });
        }

        // Verify JWT
        const decodedToken = verifyToken(token);

        // Store authenticated user information
        req.user = decodedToken;

        next();
    } catch (error) {
        // JWT has expired
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Authentication token has expired",
            });
        }

        // JWT is malformed or signature is invalid
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token",
            });
        }

        // Any unexpected authentication error
        console.error("Authentication middleware error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};