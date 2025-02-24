import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutBuilder } from "./commands/put";
import { QueryBuilder } from "./commands/query";
import { UpdateBuilder } from "./commands/update";
import { marshallMiddleware, translateConfig } from "./config";
import type { DynamoSchema, SchemaDefinition } from "./schemas/dynamo";

export class DynamoORM<S extends SchemaDefinition> {
  private client: DynamoDBDocumentClient;

  constructor(
    private schema: DynamoSchema<S>,
    client?: DynamoDBDocumentClient
  ) {
    this.client =
      client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: this.schema.getRegion() }),
        translateConfig
      );
    this.client.middlewareStack.add(marshallMiddleware, {
      step: "initialize",
      name: "dateConversionMiddleware",
      tags: ["DATE_CONVERSION"],
    });
  }

  query(): QueryBuilder<S> {
    return new QueryBuilder<S>(this.schema, this.client);
  }

  put(): PutBuilder<S> {
    return new PutBuilder<S>(this.schema, this.client);
  }

  update(): UpdateBuilder<S> {
    return new UpdateBuilder<S>(this.schema, this.client);
  }
}
