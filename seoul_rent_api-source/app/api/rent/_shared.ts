import { env } from "cloudflare:workers";

export const RENT_YEAR = "2026";
const PAGE_SIZE = 1000;
const MAX_PARALLEL_REQUESTS = 5;
const MAX_RECORDS = 100_000;
const SEOUL_API_ORIGIN = "http://openapi.seoul.go.kr:8088";
const SERVICE_NAME = "tbLnOpendataRentV";

export type RentRecord = {
  RCPT_YR: string;
  CGG_CD: string;
  CGG_NM: string;
  STDG_CD: string;
  STDG_NM: string;
  FLR: number | string;
  CTRT_DAY: string;
  RENT_SE: string;
  RENT_AREA: number | string;
  GRFE: string;
  RTFE: string;
  BLDG_NM: string;
  ARCH_YR: string;
  BLDG_USG: string;
  CTRT_PRD: string;
  NEW_UPDT_YN: string;
  CTRT_UPDT_USE_YN: string;
  BFR_GRFE: string;
  BFR_RTFE: string;
};

type ServicePayload = {
  list_total_count?: number | string;
  RESULT?: { CODE?: string; MESSAGE?: string };
  row?: RentRecord[];
};

type SeoulResponse = Record<string, ServicePayload>;

function cleanApiMessage(message: unknown) {
  return typeof message === "string" && message.trim()
    ? message.trim()
    : "서울시 데이터 요청을 처리하지 못했습니다.";
}

function createSeoulApiUrl(start: number, end: number, districtCode: string, dongCode?: string) {
  const key = env.SEOUL_API_KEY;
  if (!key) throw new Error("서울시 API 인증 설정이 없습니다.");

  const segments = [key, "json", SERVICE_NAME, String(start), String(end), RENT_YEAR, districtCode];
  if (dongCode) {
    // 서울시 Open API는 중간 선택 인자를 생략할 때 공백 경로 세그먼트를 요구합니다.
    segments.push(" ", dongCode);
  }

  return `${SEOUL_API_ORIGIN}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

async function fetchPage(start: number, end: number, districtCode: string, dongCode?: string) {
  const response = await fetch(createSeoulApiUrl(start, end, districtCode, dongCode), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error("서울시 데이터 서버가 일시적으로 응답하지 않습니다.");

  const payload = (await response.json()) as SeoulResponse;
  const service = payload[SERVICE_NAME];
  if (!service) throw new Error("서울시 데이터 응답 형식이 올바르지 않습니다.");

  const resultCode = service.RESULT?.CODE;
  if (resultCode && resultCode !== "INFO-000") throw new Error(cleanApiMessage(service.RESULT?.MESSAGE));

  const total = Number(service.list_total_count ?? service.row?.length ?? 0);
  return { total: Number.isFinite(total) ? total : 0, rows: service.row ?? [] };
}

export async function fetchAllRentRecords(districtCode: string, dongCode?: string) {
  const firstPage = await fetchPage(1, PAGE_SIZE, districtCode, dongCode);
  if (firstPage.total > MAX_RECORDS) throw new Error("조회 결과가 너무 많습니다. 더 좁은 동을 선택해 주세요.");

  const pageStarts: number[] = [];
  for (let start = PAGE_SIZE + 1; start <= firstPage.total; start += PAGE_SIZE) pageStarts.push(start);

  const remainingPages: RentRecord[] = [];
  for (let index = 0; index < pageStarts.length; index += MAX_PARALLEL_REQUESTS) {
    const starts = pageStarts.slice(index, index + MAX_PARALLEL_REQUESTS);
    const pages = await Promise.all(starts.map((start) => fetchPage(start, Math.min(start + PAGE_SIZE - 1, firstPage.total), districtCode, dongCode)));
    remainingPages.push(...pages.flatMap((page) => page.rows));
  }

  return { total: firstPage.total, rows: [...firstPage.rows, ...remainingPages].slice(0, firstPage.total) };
}

export function isDistrictCode(value: string | null) {
  return Boolean(value && /^11\d{3}$/.test(value));
}

export function isDongCode(value: string | null) {
  return Boolean(value && /^\d{5}$/.test(value));
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}
