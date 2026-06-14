FROM node:20-alpine

RUN apk add --no-cache wget fontconfig ttf-dejavu

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY .env.example ./.env.example

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/server/uploads

RUN mkdir -p /app/server/uploads && \
    addgroup -S vencely && adduser -S vencely -G vencely && \
    chown -R vencely:vencely /app

USER vencely

EXPOSE 3000

CMD ["node", "server/index.js"]
