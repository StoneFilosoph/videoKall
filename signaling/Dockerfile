FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js db.js ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]

