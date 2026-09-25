import { fetchAllRentRecords, isDistrictCode, isDongCode, jsonResponse } from "./_shared";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const districtCode = params.get("district");
  const dongCode = params.get("dong");
  if (!isDistrictCode(districtCode) || !isDongCode(dongCode)) return jsonResponse({ error: "자치구와 동을 다시 선택해 주세요." }, 400);

  try {
    const { total, rows } = await fetchAllRentRecords(districtCode, dongCode);
    return jsonResponse({ total, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "전월세 데이터를 불러오지 못했습니다.";
    return jsonResponse({ error: message }, 502);
  }
}
