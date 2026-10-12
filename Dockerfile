FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY config/network.json ./config/network.json
ENV HOST=0.0.0.0 PORT=8797
USER node
EXPOSE 8797
HEALTHCHECK --interval=60s --timeout=15s CMD node -e "fetch('http://127.0.0.1:8797/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","src/server.js"]
