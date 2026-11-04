import { Schema } from 'effect';
export const diagramBoxSchema = Schema.Struct({
  id: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(Schema.String),
  detail: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  change: Schema.mutableKey(
    Schema.optional(
      Schema.Union([
        Schema.Literal('new'),
        Schema.Literal('changed'),
        Schema.Literal('removed'),
        Schema.Undefined,
      ]),
    ),
  ),
  problem: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  layerId: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  decision: Schema.mutableKey(Schema.optional(Schema.Literal(true))),
});
const diagramArrowSchema = Schema.Struct({
  from: Schema.mutableKey(Schema.String),
  to: Schema.mutableKey(Schema.String),
  label: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});
const diagramSchema = Schema.Struct({
  boxes: Schema.mutableKey(Schema.Array(diagramBoxSchema)),
  arrows: Schema.mutableKey(Schema.Array(diagramArrowSchema)),
});
export const reviewDiagramSchema = Schema.Struct({
  after: Schema.mutableKey(diagramSchema),
});

export type DiagramBox = typeof diagramBoxSchema.Type;
export type Diagram = typeof diagramSchema.Type;
export type ReviewDiagram = typeof reviewDiagramSchema.Type;
