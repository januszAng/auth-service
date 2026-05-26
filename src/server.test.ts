import { describe, it, expect, mock } from "bun:test";

const mockListen = mock((_port: number, cb?: () => void) => {
  cb?.();
});
const mockServer = { listen: mockListen };

mock.module("node:http", () => ({
  createServer: mock(() => mockServer),
}));

mock.module("@connectrpc/connect-node", () => ({
  connectNodeAdapter: mock((opts: { routes: (r: unknown) => void }) => {
    opts.routes({ service: mock(() => {}) });
    return () => {};
  }),
}));

// Mock the deep dependencies that auth.ts needs on import
mock.module("./db/connection.js", () => ({
  db: {},
}));

describe("startServer", () => {
  it("starts an HTTP server on the specified port", async () => {
    const { startServer } = await import("./server.js");
    const server = startServer(9999);

    expect(server).toBeDefined();
    expect(mockListen).toHaveBeenCalledWith(9999, expect.any(Function));
  });

  it("uses PORT env var by default", async () => {
    process.env.PORT = "7777";
    const { startServer } = await import("./server.js");
    startServer();

    expect(mockListen).toHaveBeenCalledWith(7777, expect.any(Function));
    delete process.env.PORT;
  });
});
