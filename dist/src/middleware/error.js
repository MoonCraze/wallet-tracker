import { Logger } from "../lib/logger.js";
export class AppError extends Error {
    statusCode;
    isOperational;
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    let statusCode = 500;
    let message = "Internal Server Error";
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    else if (err instanceof SyntaxError && 'body' in err) {
        statusCode = 400;
        message = "Invalid JSON payload";
    }
    else if (err.message?.toLowerCase().includes('request aborted')) {
        statusCode = 400;
        message = "Request aborted";
    }
    Logger.error("Request error", {
        method: req.method,
        url: req.url,
        statusCode,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: "Endpoint not found",
        path: req.path
    });
}
