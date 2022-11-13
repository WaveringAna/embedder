FROM node:16

# Install dependencies
COPY package*.json ./
RUN npm install

# Package app source
COPY . .

CMD node db.js; npm start
