// src/index.js

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");

const connectDB = require("./config/database");
const validateEnv = require("./config/env");
const redisClient = require("./config/redis");

const requestLogger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const attachMarketingData = require('./middleware/marketing');
const sanitize = require("./middleware/sanitize");
const logger = require("./utils/logger");


// ==============================
// Load Environment Variables
// ==============================
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Validate env
validateEnv();

// ==============================
// Create Express App
// ==============================
const app = express();

// ==============================
// CORS Configuration
// ==============================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000" || "https://laundrica-l2b5.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Session-Id",
      "X-Landing-Page",
      "X-Original-Url",
    ],
    exposedHeaders: ["Content-Length"],
  })
);

// ==============================
// Body Parser
// ==============================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==============================
// Request Logger
// ==============================
app.use(requestLogger);

// ==============================
// Marketing Data - Attach to all requests
// ==============================
app.use(attachMarketingData);

// ==============================
// Input Sanitizer
// ==============================
app.use(sanitize);

// ==============================
// Health Route
// ==============================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running 🚀",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// Routes
// ==============================
const orderRoutes = require("./routes/order.routes");
const cartRoutes = require("./routes/cart.routes");
const productRoutes = require("./routes/product.routes");
const serviceRoutes = require("./routes/service.routes");
const contactRoutes = require("./routes/contact.routes");
const webhookRoutes = require("./routes/webhook.routes");
const analyticsRoutes = require('./routes/analytics.routes');


app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/contact", contactRoutes);
app.use("/webhook", webhookRoutes);
app.use('/api/analytics', analyticsRoutes);


// ==============================
// 404 Handler
// ==============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ==============================
// Error Handler
// ==============================
app.use(errorHandler);

// ==============================
// Start Server
// ==============================
async function startServer() {
  try {
    await connectDB();

    await redisClient.connect();

    try {
      require("./workers");
      logger.info("Workers initialized");
    } catch (err) {
      logger.warn("Workers not initialized:", err.message);
    }

    const PORT = process.env.PORT || 4000;

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);

      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📦 Environment: ${process.env.NODE_ENV}`);
    });

    server.on("error", (err) => {
      console.error("Server Error:", err);
    });

    const gracefulShutdown = async () => {
      console.log("Shutting down...");

      try {
        await redisClient.disconnect();
        await mongoose.disconnect();
      } finally {
        process.exit(0);
      }
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

module.exports = app;