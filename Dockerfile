FROM node:16-alpine AS BUILD_IMAGE

RUN apk add curl bash

# Install dependencies
COPY package*.json ./
RUN npm install

RUN npm prune --production

RUN curl -sf https://gobinaries.com/tj/node-prune | sh

FROM node:16-alpine

COPY --from=BUILD_IMAGE /node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN node db.js

CMD ["npm", "start"]