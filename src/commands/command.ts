import { TemplateKey } from "../schemas/attribute";
import type { DynamoSchema, SchemaDefinition } from "../schemas/dynamo";

export class Command<S extends SchemaDefinition> {
  protected item: Record<string, any> = {};

  constructor(protected readonly schema: DynamoSchema<S>) {}

  set<K extends keyof S>(key: K, value: S[K]["_type"]): this {
    const field = this.schema.getSchema()[key as string];
    const attrName = this.schema.getAttributeName(key as string);
    if (
      field instanceof TemplateKey &&
      typeof value === "object" &&
      value !== null
    ) {
      this.item[attrName] = field.generate(value as Record<string, string>);
    } else {
      this.item[attrName] = field.transform ? field.transform(value) : value;
    }
    return this;
  }
}
