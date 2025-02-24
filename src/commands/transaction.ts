import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  DynamoSchema,
  SchemaDefinition,
  SchemaItem,
} from "../schemas/dynamo";
import { Command } from "./command";
import type { DeleteBuilder } from "./delete";
import type { PutBuilder } from "./put";
import type { UpdateBuilder } from "./update";

type TransactionTypes =
  | PutBuilder<any>
  | DeleteBuilder<any>
  | UpdateBuilder<any>;

export class TransactionBuilder<S extends SchemaDefinition> extends Command<S> {
  private writeTransaction: TransactionTypes[] = [];

  constructor(
    readonly schema: DynamoSchema<S>,
    private readonly client: DynamoDBDocumentClient
  ) {
    super(schema);
  }

  public with(transaction: TransactionTypes): this {
    this.writeTransaction.push(transaction);
    return this;
  }

  async exec(): Promise<SchemaItem<S>> {
    const transactionCommands = this.writeTransaction.map(
      (transaction) => transaction.command
    );

    const command = new TransactWriteCommand({
      TransactItems: transactionCommands,
    });

    await this.client.send(command);
    return this.item as SchemaItem<S>;
  }
}
