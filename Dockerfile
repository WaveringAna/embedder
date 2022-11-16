FROM node:16

# Install dependencies
COPY package*.json ./
RUN npm install

# Package app source
COPY . .

ENTRYPOINT ["./docker-entrypoint.sh"]
