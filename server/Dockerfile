FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY .env.example ./.env.example

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/server/data

EXPOSE 3000

CMD ["node", "server/index.js"]
