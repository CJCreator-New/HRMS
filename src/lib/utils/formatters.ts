/**
 * Standard Indian date and currency formatters for HRMS v2.7 (M-08).
 */

/**
 * Formats a Date or ISO date string into Indian Standard format: DD-MMM-YYYY (e.g. 14-Aug-2026).
 */
export function formatDateIndian(
  date: string | Date | null | undefined,
  includeTime: boolean = false
): string {
  if (!date) return "—";

  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  const formattedDate = `${day}-${month}-${year}`;

  if (includeTime) {
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${formattedDate} ${hours}:${mins}`;
  }

  return formattedDate;
}

/**
 * Formats numbers into Indian Lakhs/Crores currency format (e.g. ₹1,50,000).
 */
export function formatCurrencyIndian(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
