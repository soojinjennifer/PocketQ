/**
 * S3-12 — 도형 JSON Schema의 strict 호환성과 zod 스키마와의 키 집합 일치(새 의존성 없이 키 집합 비교).
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  exprNodeSchema,
  figureConstraintSchema,
  figureElementSchema,
  figureSpecSchema,
  figureStepStateSchema,
  stepFigureRefSchema,
} from "validation";
import {
  FIGURE_CONSTRAINT_VARIANTS,
  FIGURE_ELEMENT_VARIANTS,
  FIGURE_INTERACTION_VARIANTS,
  FIGURE_REPAIR_JSON_SCHEMA,
  FIGURE_SPEC_SCHEMA,
  FIGURE_STEP_STATE_SCHEMA,
  FIGURES_ENVELOPE_JSON_SCHEMA,
  STEP_FIGURE_REF_SCHEMA,
} from "./figuresJsonSchema";

type Json = Record<string, unknown>;

function isJsonObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 스키마 트리의 모든 `type: "object"` 노드를 모은다. */
function collectObjectNodes(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    for (const child of node) collectObjectNodes(child, out);
  } else if (isJsonObject(node)) {
    const type = node["type"];
    if (type === "object" || (Array.isArray(type) && type.includes("object"))) out.push(node);
    for (const value of Object.values(node)) collectObjectNodes(value, out);
  }
  return out;
}

function collectRefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectRefs(child, out);
  } else if (isJsonObject(node)) {
    const ref = node["$ref"];
    if (typeof ref === "string") out.push(ref);
    for (const value of Object.values(node)) collectRefs(value, out);
  }
  return out;
}

function jsonKeys(schema: Json): string[] {
  const properties = schema["properties"];
  return isJsonObject(properties) ? Object.keys(properties).sort() : [];
}

function jsonDiscriminator(schema: Json, key: string): string[] {
  const properties = schema["properties"];
  if (!isJsonObject(properties)) return [];
  const field = properties[key];
  if (!isJsonObject(field) || !Array.isArray(field["enum"])) return [];
  return field["enum"].map(String).sort();
}

interface ZodObjectLike {
  shape: Record<string, z.ZodType>;
}

function zodKeys(schema: ZodObjectLike): string[] {
  return Object.keys(schema.shape).sort();
}

/** z.literal(값들) 또는 z.enum([...])의 값 목록. */
function zodDiscriminator(schema: ZodObjectLike, key: string): string[] {
  const field = schema.shape[key] as unknown as { values?: Set<unknown>; options?: unknown[] };
  if (field.values instanceof Set) return [...field.values].map(String).sort();
  if (Array.isArray(field.options)) return field.options.map(String).sort();
  return [];
}

function compareVariants(zodOptions: readonly ZodObjectLike[], jsonVariants: readonly Json[], key: string): void {
  expect(jsonVariants).toHaveLength(zodOptions.length);
  zodOptions.forEach((option, index) => {
    const json = jsonVariants[index];
    if (!json) throw new Error(`JSON 변형 ${index} 없음`);
    expect(zodDiscriminator(option, key).length).toBeGreaterThan(0);
    expect(jsonDiscriminator(json, key)).toEqual(zodDiscriminator(option, key));
    expect(jsonKeys(json)).toEqual(zodKeys(option));
    expect([...(json["required"] as string[])].sort()).toEqual(zodKeys(option));
  });
}

describe("S3-12 strict 호환", () => {
  for (const [name, schema] of [
    ["envelope", FIGURES_ENVELOPE_JSON_SCHEMA],
    ["repair", FIGURE_REPAIR_JSON_SCHEMA],
  ] as const) {
    it(`${name}: 루트는 object(anyOf 아님), 모든 객체 additionalProperties false·required = 전 키`, () => {
      expect(schema["type"]).toBe("object");
      expect(schema["anyOf"]).toBeUndefined();
      const objects = collectObjectNodes(schema);
      expect(objects.length).toBeGreaterThan(30);
      for (const node of objects) {
        expect(node["additionalProperties"]).toBe(false);
        expect([...(node["required"] as string[])].sort()).toEqual(jsonKeys(node));
      }
    });

    it(`${name}: $ref는 $defs의 figure·expr만 가리키고 expr은 자기 자신을 재귀 참조한다`, () => {
      const refs = new Set(collectRefs(schema));
      expect([...refs].sort()).toEqual(["#/$defs/expr", "#/$defs/figure"]);
      const defs = schema["$defs"] as Json;
      expect(collectRefs(defs["expr"])).toContain("#/$defs/expr");
    });

    it(`${name}: strict 미지원 키워드(allOf·not·if·patternProperties 등)를 쓰지 않는다`, () => {
      const text = JSON.stringify(schema);
      for (const keyword of ["allOf", "\"not\"", "\"if\"", "dependentRequired", "dependentSchemas", "patternProperties", "prefixItems", "minLength", "maxLength"]) {
        expect(text).not.toContain(keyword);
      }
    });
  }

  it("봉투 키 집합은 { figures, stepFigureRefs, omitReason }, 보정은 { figure }", () => {
    expect(jsonKeys(FIGURES_ENVELOPE_JSON_SCHEMA)).toEqual(["figures", "omitReason", "stepFigureRefs"]);
    expect(jsonKeys(FIGURE_REPAIR_JSON_SCHEMA)).toEqual(["figure"]);
  });
});

describe("S3-12 zod shape와 키 집합 일치", () => {
  it("FigureSpec", () => {
    expect(jsonKeys(FIGURE_SPEC_SCHEMA)).toEqual(zodKeys(figureSpecSchema as unknown as ZodObjectLike));
    const shape = (figureSpecSchema as unknown as ZodObjectLike).shape;
    const axes = shape["axes"] as unknown as ZodObjectLike;
    const grid = shape["grid"] as unknown as ZodObjectLike;
    const props = FIGURE_SPEC_SCHEMA["properties"] as Json;
    expect(jsonKeys(props["axes"] as Json)).toEqual(zodKeys(axes));
    expect(jsonKeys(props["grid"] as Json)).toEqual(zodKeys(grid));
  });

  it("요소 12변형(판별자 type 값·키 집합·required)", () => {
    const options = (figureElementSchema as unknown as { options: ZodObjectLike[] }).options;
    compareVariants(options, FIGURE_ELEMENT_VARIANTS, "type");
  });

  it("제약 7변형", () => {
    const options = (figureConstraintSchema as unknown as { options: ZodObjectLike[] }).options;
    compareVariants(options, FIGURE_CONSTRAINT_VARIANTS, "type");
  });

  it("interaction 2변형", () => {
    const interaction = (figureSpecSchema as unknown as ZodObjectLike).shape["interaction"] as unknown as {
      options: ZodObjectLike[];
    };
    compareVariants(interaction.options, FIGURE_INTERACTION_VARIANTS, "mode");
  });

  it("단계 상태·단계 연결", () => {
    expect(jsonKeys(FIGURE_STEP_STATE_SCHEMA)).toEqual(zodKeys(figureStepStateSchema as unknown as ZodObjectLike));
    expect(jsonKeys(STEP_FIGURE_REF_SCHEMA)).toEqual(zodKeys(stepFigureRefSchema as unknown as ZodObjectLike));
  });

  it("수식 AST 6변형", () => {
    const pipe = exprNodeSchema as unknown as { out: { unwrap: () => { options: ZodObjectLike[] } } };
    const options = pipe.out.unwrap().options;
    const defs = FIGURES_ENVELOPE_JSON_SCHEMA["$defs"] as Json;
    const variants = (defs["expr"] as Json)["anyOf"] as Json[];
    compareVariants(options, variants, "type");
  });
});
