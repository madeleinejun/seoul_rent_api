"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, CircleAlert, MapPin, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Area = { code: string; name: string };
type RentRecord = {
  CTRT_DAY: string;
  RENT_SE: string;
  RENT_AREA: number | string;
  GRFE: string;
  RTFE: string;
  BLDG_NM: string;
  FLR: number | string;
  ARCH_YR: string;
  BLDG_USG: string;
  NEW_UPDT_YN: string;
  CTRT_PRD: string;
};
type RentPayload = { total: number; rows: RentRecord[]; error?: string };

type ModelContextTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown) => unknown | Promise<unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const DISTRICTS: Area[] = [
  ["11110", "종로구"], ["11140", "중구"], ["11170", "용산구"], ["11200", "성동구"], ["11215", "광진구"],
  ["11230", "동대문구"], ["11260", "중랑구"], ["11290", "성북구"], ["11305", "강북구"], ["11320", "도봉구"],
  ["11350", "노원구"], ["11380", "은평구"], ["11410", "서대문구"], ["11440", "마포구"], ["11470", "양천구"],
  ["11500", "강서구"], ["11530", "구로구"], ["11545", "금천구"], ["11560", "영등포구"], ["11590", "동작구"],
  ["11620", "관악구"], ["11650", "서초구"], ["11680", "강남구"], ["11710", "송파구"], ["11740", "강동구"],
].map(([code, name]) => ({ code, name }));

const formatter = new Intl.NumberFormat("ko-KR");

function formatMoney(value: string) {
  const numeric = Number(value.replaceAll(",", ""));
  return Number.isFinite(numeric) ? `${formatter.format(numeric)}만` : "-";
}

function formatDate(value: string) {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}` : value;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}

export default function Home() {
  const [districtCode, setDistrictCode] = useState("");
  const [dongCode, setDongCode] = useState("");
  const [dongs, setDongs] = useState<Area[]>([]);
  const [rows, setRows] = useState<RentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingDongs, setLoadingDongs] = useState(false);
  const [loadingRent, setLoadingRent] = useState(false);
  const [error, setError] = useState("");

  const selectedDistrict = DISTRICTS.find((district) => district.code === districtCode);
  const selectedDong = dongs.find((dong) => dong.code === dongCode);

  const loadRent = useCallback(async (nextDistrict: string, nextDong: string) => {
    setLoadingRent(true);
    setError("");
    try {
      const response = await fetch(`/api/rent?district=${encodeURIComponent(nextDistrict)}&dong=${encodeURIComponent(nextDong)}`);
      const payload = (await response.json()) as RentPayload;
      if (!response.ok || payload.error) throw new Error(payload.error || "전월세 데이터를 불러오지 못했습니다.");
      setRows(payload.rows);
      setTotal(payload.total);
      return payload;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "전월세 데이터를 불러오지 못했습니다.";
      setRows([]);
      setTotal(0);
      setError(message);
      throw loadError;
    } finally {
      setLoadingRent(false);
    }
  }, []);

  const handleDistrictChange = useCallback(async (nextDistrict: string) => {
    setDistrictCode(nextDistrict);
    setDongCode("");
    setDongs([]);
    setRows([]);
    setTotal(0);
    setError("");
    setLoadingDongs(true);
    try {
      const response = await fetch(`/api/rent/dongs?district=${encodeURIComponent(nextDistrict)}`);
      const payload = (await response.json()) as { dongs?: Area[]; error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error || "동 목록을 불러오지 못했습니다.");
      setDongs(payload.dongs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "동 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingDongs(false);
    }
  }, []);

  const handleDongChange = useCallback(async (nextDong: string) => {
    setDongCode(nextDong);
    if (districtCode) await loadRent(districtCode, nextDong);
  }, [districtCode, loadRent]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "select_area_and_load_2026_rent_data",
      title: "2026년 동별 전월세 조회",
      description: "자치구 코드와 동 코드를 선택하고, 같은 화면에 해당 동의 2026년 전월세 신고 데이터를 모두 표시합니다.",
      inputSchema: {
        type: "object",
        properties: {
          districtCode: { type: "string", pattern: "^11\\d{3}$" },
          dongCode: { type: "string", pattern: "^\\d{5}$" },
        },
        required: ["districtCode", "dongCode"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const value = input as { districtCode?: unknown; dongCode?: unknown };
        if (typeof value.districtCode !== "string" || typeof value.dongCode !== "string" ||
          !/^11\d{3}$/.test(value.districtCode) || !/^\d{5}$/.test(value.dongCode)) {
          throw new Error("올바른 자치구 코드와 동 코드가 필요합니다.");
        }
        setDistrictCode(value.districtCode);
        setDongCode(value.dongCode);
        const result = await loadRent(value.districtCode, value.dongCode);
        return { total: result.total, loadedRows: result.rows.length, year: 2026 };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadRent]);

  const summary = useMemo(() => {
    const jeonse = rows.filter((row) => row.RENT_SE === "전세").map((row) => Number(String(row.GRFE).replaceAll(",", ""))).filter(Number.isFinite);
    const monthly = rows.filter((row) => row.RENT_SE === "월세").map((row) => Number(String(row.RTFE).replaceAll(",", ""))).filter(Number.isFinite);
    return { jeonseAverage: average(jeonse), monthlyAverage: average(monthly) };
  }, [rows]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-orange-200">
              <MapPin className="size-5" strokeWidth={2.5} />
            </div>
            <div><p className="text-sm font-semibold tracking-tight text-foreground">서울 전월세</p><p className="text-xs text-muted-foreground">2026 실거래 신고 조회</p></div>
          </div>
          <Badge className="hidden bg-secondary px-3 py-1 text-secondary-foreground sm:inline-flex">2026년 데이터</Badge>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:py-14">
          <div>
            <div className="mb-7 flex items-start gap-3">
              <div className="mt-1 h-9 w-1 rounded-full bg-primary" />
              <div><p className="mb-2 text-sm font-medium text-primary">지역 선택</p><h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">어느 동의 전월세를 볼까요?</h1><p className="mt-3 text-base leading-7 text-muted-foreground">자치구와 동을 고르면 해당 지역의 2026년 신고 건을 모두 불러옵니다.</p></div>
            </div>
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_12px_36px_rgb(124_45_18/0.06)] sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
              <label className="grid gap-2 text-sm font-medium text-foreground">자치구
                <Select value={districtCode} onValueChange={handleDistrictChange}>
                  <SelectTrigger className="h-12 w-full bg-background text-base"><SelectValue placeholder="자치구 선택" /></SelectTrigger>
                  <SelectContent>{DISTRICTS.map((district) => <SelectItem key={district.code} value={district.code}>{district.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">동
                <Select value={dongCode} onValueChange={handleDongChange} disabled={!districtCode || loadingDongs}>
                  <SelectTrigger className="h-12 w-full bg-background text-base"><SelectValue placeholder={loadingDongs ? "동 목록 불러오는 중" : "동 선택"} /></SelectTrigger>
                  <SelectContent>{dongs.map((dong) => <SelectItem key={dong.code} value={dong.code}>{dong.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground">
                {loadingDongs || loadingRent ? <Spinner className="size-4 text-primary" /> : <Search className="size-4 text-primary" />} 조회
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">동 목록은 선택한 자치구의 2026년 신고 자료에서 확인되는 법정동 기준입니다.</p>
          </div>
          <aside className="rounded-2xl border border-orange-100 bg-secondary/60 p-5"><Sparkles className="mb-5 size-5 text-primary" /><p className="text-sm font-semibold text-foreground">바로 확인할 수 있어요</p><p className="mt-2 text-sm leading-6 text-muted-foreground">보증금, 월세, 계약일, 면적과 건물명까지 한 번에 비교할 수 있습니다.</p><div className="mt-5 flex items-center gap-2 text-xs font-medium text-primary"><span className="size-2 rounded-full bg-primary" /> 서울시 부동산 정보광장</div></aside>
        </section>

        {error && <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
        {loadingRent ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-border bg-card"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Spinner className="size-5 text-primary" />2026년 신고 건을 모두 불러오는 중입니다.</div></div>
        ) : rows.length > 0 ? (
          <section className="pb-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-medium text-primary">조회 결과</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{selectedDistrict?.name} {selectedDong?.name} <span className="text-muted-foreground">{formatter.format(total)}건</span></h2></div><p className="text-sm text-muted-foreground">접수연도 2026 · 전체 {formatter.format(total)}건</p></div>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">신고 건수</p><p className="mt-2 text-2xl font-semibold tracking-tight">{formatter.format(total)}<span className="ml-1 text-sm font-medium text-muted-foreground">건</span></p></article>
              <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">전세 평균 보증금</p><p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(String(summary.jeonseAverage))}</p></article>
              <article className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">월세 평균</p><p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(String(summary.monthlyAverage))}</p></article>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <Table><TableHeader className="bg-muted/70"><TableRow><TableHead>계약일</TableHead><TableHead>구분</TableHead><TableHead>보증금</TableHead><TableHead>월세</TableHead><TableHead>면적</TableHead><TableHead>건물명</TableHead><TableHead>층</TableHead><TableHead>계약</TableHead></TableRow></TableHeader><TableBody>
                {rows.map((row, index) => <TableRow key={`${row.CTRT_DAY}-${row.BLDG_NM}-${row.FLR}-${index}`}><TableCell className="font-medium">{formatDate(row.CTRT_DAY)}</TableCell><TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">{row.RENT_SE}</Badge></TableCell><TableCell>{formatMoney(row.GRFE)}</TableCell><TableCell>{row.RENT_SE === "전세" ? "-" : formatMoney(row.RTFE)}</TableCell><TableCell>{row.RENT_AREA}㎡</TableCell><TableCell><div className="max-w-44 truncate font-medium" title={row.BLDG_NM}>{row.BLDG_NM || "-"}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.BLDG_USG || "주거용"} · {row.ARCH_YR || "-"}년</div></TableCell><TableCell>{row.FLR || "-"}</TableCell><TableCell className="text-muted-foreground">{row.CTRT_PRD || row.NEW_UPDT_YN || "-"}</TableCell></TableRow>)}
              </TableBody></Table>
            </div>
          </section>
        ) : (
          <Empty className="min-h-64 border-border bg-card"><EmptyHeader><EmptyMedia variant="icon" className="bg-secondary text-primary"><Building2 /></EmptyMedia><EmptyTitle>{districtCode ? "동을 선택해 주세요" : "조회할 지역을 선택해 주세요"}</EmptyTitle><EmptyDescription>{districtCode ? "동을 선택하면 2026년 전월세 신고 건이 바로 표시됩니다." : "서울 25개 자치구에서 원하는 지역을 먼저 골라 주세요."}</EmptyDescription></EmptyHeader></Empty>
        )}
        <footer className="flex flex-wrap items-center gap-2 border-t border-border py-6 text-xs text-muted-foreground"><span>자료: 서울시 부동산 전월세가 정보</span><ChevronRight className="size-3" /><span>금액 단위: 만원</span><ChevronRight className="size-3" /><span>마지막 조회 결과 기준</span></footer>
      </div>
    </main>
  );
}
