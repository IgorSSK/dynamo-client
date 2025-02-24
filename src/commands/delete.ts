import {
  DeleteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { TemplateKey } from "../schemas/attribute";
import type {
  DynamoSchema,
  SchemaDefinition,
  SchemaItem,
} from "../schemas/dynamo";
import { Command } from "./command";

export class DeleteBuilder<S extends SchemaDefinition> extends Command<S> {
  private deleteKeys: Record<string, string> = {};
  constructor(
    readonly schema: DynamoSchema<S>,
    private readonly client: DynamoDBDocumentClient
  ) {
    super(schema);
  }

  public keys<K extends keyof S>(input: Record<K, S[K]["_type"]>): this {
    for (const [key, value] of Object.entries(input) as [K, S[K]["_type"]][]) {
      const field = this.schema.getSchema()[key as string];
      const attrName = this.schema.getAttributeName(key);

      if (
        field instanceof TemplateKey &&
        typeof value === "object" &&
        value !== null
      )
        this.deleteKeys[attrName] = field.generate(
          value as Record<string, string>
        );
      else this.deleteKeys[attrName] = value;
    }
    return this;
  }

  public get command() {
    return new DeleteCommand({
      TableName: this.schema.getTable(),
      Key: this.deleteKeys,
    });
  }

  async exec(): Promise<SchemaItem<S>> {
    await this.client.send(this.command);
    return this.item as SchemaItem<S>;
  }
}
