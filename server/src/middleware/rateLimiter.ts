import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyAccessToken } from "./auth";

// Reuses verifyAccessToken directly (a small duplicate JWT-verify per
// request when a cookie is present) rather than threading a shared req.user
// through from route-level `authenticate`/`optionalAuthenticate` — those
// only run on the routes that opt into them, but this needs to run globally.
export default rateLimit({
  windowMs: 60_000,
  limit: async (req) => ((await verifyAccessToken(req)) ? 100 : 20),
  keyGenerator: async (req) => {
    const user = await verifyAccessToken(req);
    // ipKeyGenerator normalizes IPv6 addresses to a /56 subnet — without it,
    // a single IPv6 user could dodge the anonymous limit by cycling through
    // addresses in their own subnet.
    return user ? `user:${user.sub}` : ipKeyGenerator(req.ip ?? "unknown");
  },
  standardHeaders: true,
  legacyHeaders: false,
});
