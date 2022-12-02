FROM node:16-alpine AS BUILD_IMAGE

RUN apk add curl
RUN curl -sf https://gobinaries.com/tj/node-prune | sh

COPY package*.json ./
RUN npm install

RUN npm prune --production
RUN /usr/local/bin/node-prune

FROM node:16-alpine

COPY --from=BUILD_IMAGE /node_modules ./node_modules
COPY /app ./app
COPY package*.json ./

ENV NODE_ENV=production

RUN node /app/db.js

CMD ["npm", "start"]