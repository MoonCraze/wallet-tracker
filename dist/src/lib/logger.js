export class Logger {
    static formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    }
    static info(message, meta) {
        console.log(this.formatMessage('info', message, meta));
    }
    static warn(message, meta) {
        console.warn(this.formatMessage('warn', message, meta));
    }
    static error(message, meta) {
        console.error(this.formatMessage('error', message, meta));
    }
    static debug(message, meta) {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_EVENTS === 'true') {
            console.log(this.formatMessage('debug', message, meta));
        }
    }
}
