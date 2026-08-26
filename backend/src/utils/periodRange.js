/**
 * Convierte un período preseteado ('day'|'week'|'month'|'year'|'total') en
 * un rango de fechas { from, to } — mismo cálculo que ya usaba
 * adminController.getFinancialStats de forma inline, extraído acá para que
 * statisticsController lo reutilice sin duplicar la lógica de fechas
 * (ambos controllers ahora llaman a esta misma función).
 *
 * `from` queda `undefined` para 'total' y para cualquier valor no
 * reconocido — mismo comportamiento "sin piso" que ya tenía el código
 * original (nunca tiraba error ante un período inválido, simplemente no
 * filtraba). `to` siempre es "ahora": ninguna pantalla del proyecto pide
 * todavía un rango con fecha de fin explícita.
 */
function getPeriodRange(period) {
  const now = new Date();
  let from;
  if (period === 'day') {
    from = new Date(now); from.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
  }
  return { from, to: now };
}

module.exports = { getPeriodRange };
