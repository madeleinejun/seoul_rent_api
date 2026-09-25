import { fetchAllRentRecords, isDistrictCode, jsonResponse } from "../_shared";

export async function GET(request: Request) {
  const districtCode = new URL(request.url).searchParams.get("district");
  if (!isDistrictCode(districtCode)) return jsonResponse({ error: "올바른 자치구를 선택해 주세요." }, 400);

  try {
    const { rows } = await fetchAllRentRecords(districtCode);
    const byCode = new Map<string, string>();
    for (const row of rows) if (row.STDG_CD && row.STDG_NM) byCode.set(row.STDG_CD, row.STDG_NM);
    const dongs = [...byCode.entries()].map(([code, name]) => ({ code, name })).sort((left, right) => left.name.localeCompare(right.name, "ko"));
    return jsonResponse({ dongs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "동 목록을 불러오지 못했습니다.";
    return jsonResponse({ error: message }, 502);
  }
}
