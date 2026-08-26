/**
 * Rate limiter simple en memoria — sin dependencia nueva (mismo criterio
 * que notificationService.js, que llama a la API de Expo a mano en vez de
 * traer su SDK). Alcanza de sobra para el volumen de este proyecto
 * (~200 usuarios, un solo proceso Node, sin necesidad de un store
 * distribuido tipo Redis).
 *
 * Fixed-window por IP: si se superan `max` requests dentro de `windowMs`,
 * responde 429 hasta que la ventana expire. Requiere `app.set('trust
 * proxy', ...)` en app.js para que `req.ip` refleje la IP real del cliente
 * detrás de un proxy (Render u otro) en vez de la IP del proxy para todos.
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Barrido periódico para no acumular entradas de IPs viejas para siempre.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now > entry.resetAt) hits.delete(ip);
    }
  }, windowMs);
  sweep.unref?.(); // no debe mantener vivo el proceso por sí solo

  return function rateLimiter(req, res, next) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        error: message || 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
