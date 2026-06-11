import app from "../src/app.js"

process.env.TZ = "UTC";

export default function handler(req, res) {
  console.log("Incoming request:", req.url)
  return app(req, res)
}