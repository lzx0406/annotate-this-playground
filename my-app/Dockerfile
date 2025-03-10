# Step 1: Build the SvelteKit app
FROM node:18 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the SvelteKit app for production
RUN npm run build

# Step 2: Serve the SvelteKit app with Node.js
FROM node:18-alpine AS server

# Set the working directory in the new container
WORKDIR /app

# Copy the built files from the build stage
COPY --from=build /app /app

# Install only production dependencies (ensure package.json is copied for production deps)
COPY package*.json ./
RUN npm install --production

# Expose port 3000
EXPOSE 3000

ENV NODE_ENV=server

# Start the SvelteKit app server using the correct path
# CMD ["node", ".svelte-kit/output/server/index.js"]
CMD ["node", "build"]

