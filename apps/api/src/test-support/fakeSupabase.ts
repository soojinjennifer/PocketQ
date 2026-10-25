/**
 * 테스트 전용 메모리 가짜 Supabase(PostgREST) 클라이언트. **실제 Supabase에 연결하지 않는다.**
 *
 * `problemRepository`가 쓰는 빌더 체인(`from().select/insert/upsert/update/delete().eq/in/gte/order/limit/maybeSingle`)만
 * 흉내낸다. 정의되지 않은 테이블·컬럼은 PostgREST처럼 거부한다 — 마이그레이션 적용 전/후를 같은 코드로 시험하기 위해서다.
 * - 없는 테이블: `PGRST205`(기본) 또는 `42P01`
 * - 조회의 없는 컬럼: `42703`(`column t.c does not exist`)
 * - 쓰기의 없는 컬럼: `PGRST204`(`Could not find the 'c' column of 't' in the schema cache`, 바꿀 수 있음)
 * - `arrayJsonColumns`: null 또는 배열만 허용(마이그레이션의 jsonb_typeof check, `23514`)
 *
 * 모든 쿼리는 `calls`에 테이블·연산 순서대로 기록된다(바이트 기준값 비교용).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FakeOp {
  method: string;
  args: unknown[];
}

export interface FakeCall {
  table: string;
  ops: FakeOp[];
}

export interface FakeError {
  code: string;
  message: string;
}

export interface FakeResult {
  data: unknown;
  error: FakeError | null;
  count?: number | null;
}

export type FakeRow = Record<string, unknown>;

export interface FakeTableDef {
  columns: readonly string[];
  /** onConflict 없이 upsert할 때 쓰는 기본 충돌 키와 unique 검사. */
  unique?: readonly string[];
  /** null 또는 배열만 허용하는 jsonb 컬럼(check 제약). */
  arrayJsonColumns?: readonly string[];
  /** 행 단위 check 제약(쓰기 후 최종 행 기준). 위반이면 메시지를 돌려준다. */
  rowChecks?: readonly ((row: FakeRow) => string | null)[];
  /** 컬럼 기본값(행 생성 시). 함수면 매번 호출한다. */
  defaults?: Record<string, unknown>;
}

export interface FakeSupabaseOptions {
  tables: Record<string, FakeTableDef>;
  rows?: Record<string, FakeRow[]>;
  missingTableCode?: "PGRST205" | "42P01";
  missingWriteColumnCode?: "PGRST204" | "42703";
}

/** 실행 직전 가로채기: 결과를 바꾸거나(throw 포함) 지연시킬 수 있다. `undefined`면 정상 실행. */
export type FakeInterceptor = (call: FakeCall) => FakeResult | Promise<FakeResult | undefined> | undefined;

/** 현재(마이그레이션 적용 전) 운영 스키마. `20260816000000_persistence.sql` 기준. */
export const BASE_TABLES: Record<string, FakeTableDef> = {
  problems: {
    columns: ["id", "user_id", "grade", "input_type", "recognized_text", "recognized_latex", "created_at"],
    unique: ["id"],
  },
  solutions: {
    columns: ["id", "problem_id", "concept_md", "solution_md", "answer_md", "concept_tags", "ai_provider", "ai_model", "created_at"],
    unique: ["problem_id"],
  },
  chat_messages: {
    columns: ["id", "problem_id", "role", "content", "created_at"],
  },
};

/** `20261025000000_solution_figures.sql` 적용 후 solutions. */
export const SOLUTIONS_WITH_FIGURES: FakeTableDef = {
  columns: [
    ...(BASE_TABLES["solutions"]?.columns ?? []),
    "figures",
    "step_figure_refs",
    "figures_schema_version",
    "figures_run_id",
  ],
  unique: ["problem_id"],
  arrayJsonColumns: ["figures", "step_figure_refs"],
};

/** `20261025000100_resume_solutions.sql`. */
/** `20261025000100` work 제약 3개(§12.1). pg_column_size(≤65,536)는 JSON 길이로 근사한다(서버 상한 32,768B보다 느슨 — 재작업 1). */
const RESUME_WORK_CHECKS: readonly ((row: FakeRow) => string | null)[] = [
  (row) => {
    const lines = row["work_lines"];
    if (lines === null || lines === undefined) return null;
    return Array.isArray(lines) && lines.length <= 50 && JSON.stringify(lines).length <= 65_536
      ? null
      : "resume_solutions_work_lines_shape";
  },
  (row) => {
    const none = row["work_lines"] == null && row["last_valid_line"] == null && row["stall_line"] == null;
    const some = row["work_lines"] != null && row["last_valid_line"] != null;
    return none || some ? null : "resume_solutions_work_context_all_or_none";
  },
  (row) => {
    const last = row["last_valid_line"];
    const stall = row["stall_line"];
    return (last == null || (typeof last === "number" && last >= 0)) && (stall == null || (typeof stall === "number" && stall >= 1))
      ? null
      : "resume_solutions_line_range";
  },
];

export const RESUME_SOLUTIONS_TABLE: FakeTableDef = {
  rowChecks: RESUME_WORK_CHECKS,
  columns: [
    "id",
    "problem_id",
    "mode",
    "method_name",
    "solution_md",
    "answer_md",
    "verified",
    "ai_provider",
    "ai_model",
    "figures",
    "step_figure_refs",
    "figures_schema_version",
    "figures_run_id",
    "work_lines",
    "last_valid_line",
    "stall_line",
    "created_at",
    "updated_at",
  ],
  unique: ["problem_id"],
  arrayJsonColumns: ["figures", "step_figure_refs"],
};

export function tablesFor(options: { figureColumns: boolean; resumeTable: boolean }): Record<string, FakeTableDef> {
  return {
    ...BASE_TABLES,
    ...(options.figureColumns ? { solutions: SOLUTIONS_WITH_FIGURES } : {}),
    ...(options.resumeTable ? { resume_solutions: RESUME_SOLUTIONS_TABLE } : {}),
  };
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

let idCounter = 0;

export function createFakeSupabase(options: FakeSupabaseOptions) {
  const calls: FakeCall[] = [];
  const store = new Map<string, FakeRow[]>();
  for (const [table, rows] of Object.entries(options.rows ?? {})) store.set(table, clone(rows));
  let tables = { ...options.tables };
  let interceptor: FakeInterceptor | null = null;
  const missingTableCode = options.missingTableCode ?? "PGRST205";
  const missingWriteColumnCode = options.missingWriteColumnCode ?? "PGRST204";

  function rowsOf(table: string): FakeRow[] {
    let rows = store.get(table);
    if (!rows) {
      rows = [];
      store.set(table, rows);
    }
    return rows;
  }

  function missingTable(table: string): FakeError {
    return missingTableCode === "PGRST205"
      ? { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` }
      : { code: "42P01", message: `relation "public.${table}" does not exist` };
  }

  function writeColumnError(table: string, column: string): FakeError {
    return missingWriteColumnCode === "PGRST204"
      ? { code: "PGRST204", message: `Could not find the '${column}' column of '${table}' in the schema cache` }
      : { code: "42703", message: `column "${column}" of relation "${table}" does not exist` };
  }

  function validateWrite(table: string, def: FakeTableDef, row: FakeRow): FakeError | null {
    for (const key of Object.keys(row)) {
      if (!def.columns.includes(key)) return writeColumnError(table, key);
    }
    for (const column of def.arrayJsonColumns ?? []) {
      const value = row[column];
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        return { code: "23514", message: `new row for relation "${table}" violates check constraint` };
      }
    }
    return null;
  }

  function withDefaults(def: FakeTableDef, row: FakeRow): FakeRow {
    const next: FakeRow = {};
    for (const column of def.columns) next[column] = null;
    if (def.columns.includes("id")) next["id"] = `fake-id-${(idCounter += 1)}`;
    if (def.columns.includes("created_at")) next["created_at"] = new Date(0).toISOString();
    for (const [column, value] of Object.entries(def.defaults ?? {})) {
      next[column] = typeof value === "function" ? (value as () => unknown)() : value;
    }
    return { ...next, ...clone(row) };
  }

  function matches(row: FakeRow, filters: FakeOp[]): boolean {
    for (const filter of filters) {
      const [column, value] = filter.args as [string, unknown];
      if (filter.method === "eq" && row[column] !== value) return false;
      if (filter.method === "in" && !(value as unknown[]).includes(row[column])) return false;
      if (filter.method === "gte" && !(String(row[column]) >= String(value))) return false;
    }
    return true;
  }

  function project(row: FakeRow, columns: string[]): FakeRow {
    const out: FakeRow = {};
    for (const column of columns) out[column] = clone(row[column]);
    return out;
  }

  function execute(call: FakeCall, single: boolean): FakeResult {
    const def = tables[call.table];
    if (!def) return { data: null, error: missingTable(call.table) };
    const ops = call.ops;
    const filters = ops.filter((op) => op.method === "eq" || op.method === "in" || op.method === "gte");
    const selectOp = ops.find((op) => op.method === "select");
    const selectColumns =
      selectOp && typeof selectOp.args[0] === "string"
        ? selectOp.args[0].split(",").map((part) => part.trim()).filter((part) => part.length > 0)
        : null;
    if (selectColumns) {
      for (const column of selectColumns) {
        if (!def.columns.includes(column)) {
          return { data: null, error: { code: "42703", message: `column ${call.table}.${column} does not exist` } };
        }
      }
    }
    const rows = rowsOf(call.table);
    const writeOp = ops.find((op) => ["insert", "upsert", "update", "delete"].includes(op.method));
    let affected: FakeRow[] = [];

    if (writeOp?.method === "insert" || writeOp?.method === "upsert") {
      const payload = writeOp.args[0];
      const list = (Array.isArray(payload) ? payload : [payload]) as FakeRow[];
      const writeOptions = (writeOp.args[1] ?? {}) as { onConflict?: string; ignoreDuplicates?: boolean };
      for (const row of list) {
        const error = validateWrite(call.table, def, row);
        if (error) return { data: null, error };
      }
      for (const row of list) {
        const conflictKey = writeOptions.onConflict ?? def.unique?.[0];
        const current =
          writeOp.method === "upsert" && conflictKey !== undefined
            ? rows.find((candidate) => candidate[conflictKey] === row[conflictKey])
            : undefined;
        const candidate = current ? { ...current, ...row } : withDefaults(def, row);
        for (const check of def.rowChecks ?? []) {
          const violation = check(candidate);
          if (violation) return { data: null, error: { code: "23514", message: `violates check constraint "${violation}"` } };
        }
      }
      for (const row of list) {
        const conflictKey = writeOptions.onConflict ?? def.unique?.[0];
        const existing =
          writeOp.method === "upsert" && conflictKey !== undefined
            ? rows.find((candidate) => candidate[conflictKey] === row[conflictKey])
            : undefined;
        if (existing) {
          if (!writeOptions.ignoreDuplicates) Object.assign(existing, clone(row));
          affected.push(existing);
        } else {
          const created = withDefaults(def, row);
          rows.push(created);
          affected.push(created);
        }
      }
    } else if (writeOp?.method === "update") {
      const patch = writeOp.args[0] as FakeRow;
      const error = validateWrite(call.table, def, patch);
      if (error) return { data: null, error };
      affected = rows.filter((row) => matches(row, filters));
      for (const row of affected) {
        for (const check of def.rowChecks ?? []) {
          const violation = check({ ...row, ...patch });
          if (violation) return { data: null, error: { code: "23514", message: `violates check constraint "${violation}"` } };
        }
      }
      for (const row of affected) Object.assign(row, clone(patch));
    } else if (writeOp?.method === "delete") {
      affected = rows.filter((row) => matches(row, filters));
      store.set(
        call.table,
        rows.filter((row) => !affected.includes(row)),
      );
    } else {
      affected = rows.filter((row) => matches(row, filters));
      const order = ops.find((op) => op.method === "order");
      if (order) {
        const [column, orderOptions] = order.args as [string, { ascending?: boolean } | undefined];
        const direction = orderOptions?.ascending === false ? -1 : 1;
        affected = [...affected].sort((a, b) => (String(a[column]) < String(b[column]) ? -direction : String(a[column]) > String(b[column]) ? direction : 0));
      }
      const limit = ops.find((op) => op.method === "limit");
      if (limit) affected = affected.slice(0, limit.args[0] as number);
    }

    const selectOptions = (selectOp?.args[1] ?? {}) as { count?: string; head?: boolean };
    if (selectOptions.head) return { data: null, error: null, count: affected.length };
    if (writeOp && !selectOp) return { data: null, error: null };
    const projected = affected.map((row) => (selectColumns ? project(row, selectColumns) : clone(row)));
    if (single) return { data: projected[0] ?? null, error: null };
    return { data: projected, error: null };
  }

  async function run(call: FakeCall, single: boolean): Promise<FakeResult> {
    calls.push(call);
    if (interceptor) {
      const intercepted = await interceptor(call);
      if (intercepted) return intercepted;
    }
    return execute(call, single);
  }

  function builder(table: string) {
    const call: FakeCall = { table, ops: [] };
    const chain = {
      select: (...args: unknown[]) => push("select", args),
      insert: (...args: unknown[]) => push("insert", args),
      upsert: (...args: unknown[]) => push("upsert", args),
      update: (...args: unknown[]) => push("update", args),
      delete: (...args: unknown[]) => push("delete", args),
      eq: (...args: unknown[]) => push("eq", args),
      in: (...args: unknown[]) => push("in", args),
      gte: (...args: unknown[]) => push("gte", args),
      order: (...args: unknown[]) => push("order", args),
      limit: (...args: unknown[]) => push("limit", args),
      maybeSingle: () => {
        call.ops.push({ method: "maybeSingle", args: [] });
        return run(call, true);
      },
      then: <T>(onFulfilled: (value: FakeResult) => T, onRejected?: (reason: unknown) => T) =>
        run(call, false).then(onFulfilled, onRejected),
    };
    function push(method: string, args: unknown[]) {
      call.ops.push({ method, args: clone(args) });
      return chain;
    }
    return chain;
  }

  const client = { from: (table: string) => builder(table) };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    rows: (table: string): FakeRow[] => clone(rowsOf(table)),
    /** 행을 직접 넣거나 바꾼다(DB 변조 시나리오용, 제약 검사 없음). */
    seed(table: string, rows: FakeRow[]): void {
      store.set(table, clone(rows));
    },
    /** 마이그레이션 적용 등 스키마 교체. */
    setTables(next: Record<string, FakeTableDef>): void {
      tables = { ...next };
    },
    intercept(next: FakeInterceptor | null): void {
      interceptor = next;
    },
    clearCalls(): void {
      calls.length = 0;
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
