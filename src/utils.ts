type UnknownObject = Record<string, unknown>;

export const marshallWithDateConversion = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(marshallWithDateConversion);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as UnknownObject).map(([key, val]) => [
        key,
        marshallWithDateConversion(val),
      ])
    );
  }
  return value;
};

export const unmarshallWithDateConversion = (value: unknown): unknown => {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
  ) {
    return new Date(value);
  }
  if (Array.isArray(value)) {
    return value.map(unmarshallWithDateConversion);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as UnknownObject).map(([key, val]) => [
        key,
        unmarshallWithDateConversion(val),
      ])
    );
  }
  return value;
};
