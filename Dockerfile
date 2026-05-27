FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY . .

EXPOSE 50051

CMD ["bun", "run", "index.ts"]
