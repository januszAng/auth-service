import { describe, expect, it, mock } from "bun:test";

const mockListen = mock((_port: number, cb?: () => void) => {
  cb?.();
});
const mockOn = mock(() => {});
const mockClose = mock((cb?: () => void) => {
  cb?.();
});
const mockServer = { listen: mockListen, on: mockOn, close: mockClose };

mock.module("node:http2", () => ({
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
  it("starts an HTTP2 server on the specified port", async () => {
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
