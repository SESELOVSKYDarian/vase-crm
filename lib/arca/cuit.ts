export function normalizeCuit(input: string) {
  return input.replace(/[^0-9]/g, "");
}
export function isValidCuit(input: string) {
  const cuit = normalizeCuit(input);
  if (!/^\d{11}$/.test(cuit) || /^([0-9])\1{10}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(cuit[index]) * weight,
    0,
  );
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(cuit[10]);
}
export function formatCuit(input: string) {
  const cuit = normalizeCuit(input);
  return cuit.length === 11
    ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
    : input;
}
