FROM node:20-alpine AS builder
WORKDIR /docs

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
