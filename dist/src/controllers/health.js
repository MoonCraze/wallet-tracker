export class HealthController {
    async healthCheck(req, res) {
        res.json({
            ok: true,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    }
}
