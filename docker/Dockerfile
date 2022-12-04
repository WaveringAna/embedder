FROM node:16-alpine AS BUILD_IMAGE

RUN apk add curl

COPY package*.json ./
COPY tsconfig.json ./
COPY /app ./app
RUN npm install

RUN npm prune --production

FROM node:16-alpine

COPY --from=BUILD_IMAGE /node_modules ./node_modules
COPY --from=BUILD_IMAGE /dist ./dist
COPY package*.json ./
COPY tsconfig.json ./

ENV NODE_ENV=production

CMD ["npm", "start"]
