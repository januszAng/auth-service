import { createServer } from "node:http";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { AuthService } from "./gen/auth_pb.js";
import { authServiceImpl } from "./services/auth.js";

export function startServer(port = Number(process.env.PORT) || 50051) {
  const handler = connectNodeAdapter({
    routes(router) {
      router.service(AuthService, authServiceImpl);
    },
  });

  const server = createServer(handler);

  server.listen(port, () => {
    console.log(`Auth service listening on http://localhost:${port}`);
  });

  return server;
}
