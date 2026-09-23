export function buildContractReviewUrl(employeeName: string): string {
  const params = new URLSearchParams({
    sub: "hop-dong",
    contractSearch: employeeName.trim(),
  });
  return `/nhan-su?${params.toString()}`;
}

export function readContractSearch(search: string): string {
  return new URLSearchParams(search).get("contractSearch")?.trim() || "";
}
