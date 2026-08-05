import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30m";

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
}

/**
 * Generate an authentication JWT.
 *
 * @param {Object} user
 * @param {number|string} user.user_id
 * @param {string} user.role
 * @returns {string}
 */
export const generateToken = (user) => {
    return jwt.sign(
        {
            user_id: user.user_id,
            role: user.role,
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
        }
    );
};

/**
 * Verify an authentication JWT.
 *
 * @param {string} token
 * @returns {Object}
 * @throws {Error}
 */
export const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};