# Stage 1: Build the React app
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the app
RUN npm run build

# Stage 2: Serve the app with a lightweight server
FROM node:18-alpine

WORKDIR /app

# Copy built files from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./

# Install serve to run the app
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 3000

# Serve the app
CMD ["serve", "-s", "build", "-l", "3000"]
