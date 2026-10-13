export const eq = (value: string) => "eq." + encodeURIComponent(value);
export const write = (
  body: unknown,
  method = "POST",
  prefer = "resolution=merge-duplicates,return=minimal",
) => ({ method, body: JSON.stringify(body), headers: { Prefer: prefer } });
