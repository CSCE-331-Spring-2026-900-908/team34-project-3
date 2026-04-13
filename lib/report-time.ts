export const BUSINESS_TIME_ZONE = "America/Chicago";

const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

const businessDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: BUSINESS_TIME_ZONE
});

const businessClockPartsFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: BUSINESS_TIME_ZONE
});

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatBusinessDate(value: string | Date) {
  return businessDateFormatter.format(toDate(value));
}

export function formatBusinessDateTime(value: string | Date) {
  return businessDateTimeFormatter.format(toDate(value));
}

export function getBusinessDateKey(value: string | Date) {
  const parts = businessClockPartsFormatter.formatToParts(toDate(value));

  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

export function getBusinessHour(value: string | Date) {
  const parts = businessClockPartsFormatter.formatToParts(toDate(value));

  return Number(getPart(parts, "hour"));
}
