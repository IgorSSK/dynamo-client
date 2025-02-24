import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type {
  DynamoSchema,
  SchemaDefinition,
  SchemaItem,
} from "../schemas/dynamo";
import { Command } from "./command";

export class PutBuilder<S extends SchemaDefinition> extends Command<S> {
  constructor(
    readonly schema: DynamoSchema<S>,
    private readonly client: DynamoDBDocumentClient
  ) {
    super(schema);
  }

  public get command() {
    return new PutCommand({
      TableName: this.schema.getTable(),
      Item: this.item,
    });
  }

  async exec(): Promise<SchemaItem<S>> {
    await this.client.send(this.command);
    return this.item as SchemaItem<S>;
  }
}
