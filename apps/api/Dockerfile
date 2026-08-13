FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build --workspace=url-checker-api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
