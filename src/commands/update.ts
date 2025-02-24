import {
  type DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoSchema, SchemaDefinition } from "src/schemas/dynamo";
import { TemplateKey } from "../schemas/attribute";
import { Command } from "./command";

export class UpdateBuilder<S extends SchemaDefinition> extends Command<S> {
  private updateKeys: Record<string, string> = {};
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
        this.updateKeys[attrName] = field.generate(
          value as Record<string, string>
        );
      else this.updateKeys[attrName] = value;
    }
    return this;
  }

  public get command() {
    const updateExpression = `SET ${Object.keys(this.item)
      .map((key) => `#${key} = :${key}`)
      .join(", ")}`;

    const expressionAttributeNames = Object.fromEntries(
      Object.keys(this.item).map((key) => [`#${key}`, key])
    );

    const expressionAttributeValues = Object.fromEntries(
      Object.entries(this.item).map(([key, value]) => [`:${key}`, value])
    );

    return new UpdateCommand({
      TableName: this.schema.getTable(),
      Key: this.updateKeys,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });
  }

  async exec(): Promise<void> {
    await this.client.send(this.command);
  }
}
