FROM node:16

# Create app dir
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Package app source
COPY . .

CMD node db.js; npm start
