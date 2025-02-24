import {
  type DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { TemplateKey } from "../schemas/attribute";
import type { DynamoSchema, SchemaDefinition } from "../schemas/dynamo";

export class QueryBuilder<S extends SchemaDefinition> {
  private keyConditions: string[] = [];
  private attributeNames: Record<string, string> = {};
  private attributeValues: Record<string, any> = {};
  private filterExpressions: string[] = [];
  private _limit = 0;
  private indexName = "";

  constructor(
    readonly schema: DynamoSchema<S>,
    private readonly client: DynamoDBDocumentClient
  ) {}

  /**
   * Sets a partition key equality condition using a schema definition key.
   */
  public keys<K extends keyof S>(input: Record<K, S[K]["_type"]>): this {
    for (const [key, value] of Object.entries(input) as [K, S[K]["_type"]][]) {
      const field = this.schema.getSchema()[key as string];
      const attrName = this.schema.getAttributeName(key);
      const namePlaceholder = `#${attrName}`;
      const valuePlaceholder = `:${attrName}`;
      this.keyConditions.push(`${namePlaceholder} = ${valuePlaceholder}`);
      this.attributeNames[namePlaceholder] = attrName;
      if (
        field instanceof TemplateKey &&
        typeof value === "object" &&
        value !== null
      )
        this.attributeValues[valuePlaceholder] = field.generate(
          value as Record<string, string>
        );
      else this.attributeValues[valuePlaceholder] = value;
    }
    return this;
  }

  /**
   * Adds an attribute_exists condition using a schema definition key.
   */
  public attributeExists<K extends keyof S>(key: K): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    this.filterExpressions.push(`attribute_exists(${namePlaceholder})`);
    this.attributeNames[namePlaceholder] = attrName;

    return this;
  }

  /**
   * Adds an attribute_not_exists condition using a schema definition key.
   */
  public attributeNotExists<K extends keyof S>(key: K): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    this.filterExpressions.push(`attribute_not_exists(${namePlaceholder})`);
    this.attributeNames[namePlaceholder] = attrName;
    return this;
  }

  /**
   * Adds an attribute_type condition using a schema definition key.
   */
  public attributeType<K extends keyof S>(key: K, type: string): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    const valuePlaceholder = `:${attrName}_type`;
    this.filterExpressions.push(
      `attribute_type(${namePlaceholder}, ${valuePlaceholder})`
    );
    this.attributeNames[namePlaceholder] = attrName;
    this.attributeValues[valuePlaceholder] = type;
    return this;
  }

  /**
   * Adds a contains condition using a schema definition key.
   */
  public contains<K extends keyof S>(key: K, operand: string): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    const valuePlaceholder = `:${attrName}_contains`;
    this.filterExpressions.push(
      `contains(${namePlaceholder}, ${valuePlaceholder})`
    );
    this.attributeNames[namePlaceholder] = attrName;
    this.attributeValues[valuePlaceholder] = operand;
    return this;
  }

  /**
   * Adds a begins_with condition using a schema definition key.
   */
  public beginsWith<K extends keyof S>(key: K, prefix: string): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    const valuePlaceholder = `:${attrName}_begins`;
    this.keyConditions.push(
      `begins_with(${namePlaceholder}, ${valuePlaceholder})`
    );
    this.attributeNames[namePlaceholder] = attrName;
    this.attributeValues[valuePlaceholder] = prefix;
    return this;
  }

  /**
   * Adds a size condition using a schema definition key.
   */
  public size<K extends keyof S>(
    key: K,
    operator: string,
    value: number
  ): this {
    const attrName = this.schema.getAttributeName(key);
    const namePlaceholder = `#${attrName}`;
    const valuePlaceholder = `:${attrName}_size`;
    this.keyConditions.push(
      `size(${namePlaceholder}) ${operator} ${valuePlaceholder}`
    );
    this.attributeNames[namePlaceholder] = attrName;
    this.attributeValues[valuePlaceholder] = { N: value.toString() };
    return this;
  }

  /** Sets the maximum number of items to evaluate. */
  public limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  /** Sets the index name if querying a secondary index. */
  public index(indexName: string): this {
    this.indexName = indexName;
    return this;
  }

  /**
   * Finalizes and returns the QueryCommandInput.
   */
  public async exec<K extends keyof S>(): Promise<Record<K, S[K]["_type"]>> {
    const cmd = new QueryCommand({
      TableName: this.schema.getTable(),
    });

    if (this.keyConditions.length > 0)
      cmd.input.KeyConditionExpression = this.keyConditions.join(" and ");
    if (Object.keys(this.attributeNames).length > 0)
      cmd.input.ExpressionAttributeNames = this.attributeNames;
    if (Object.keys(this.attributeValues).length > 0)
      cmd.input.ExpressionAttributeValues = this.attributeValues;
    if (this.filterExpressions.length > 0)
      cmd.input.FilterExpression = this.filterExpressions.join(" and ");
    if (this._limit > 0) cmd.input.Limit = this._limit;
    if (this.indexName) cmd.input.IndexName = this.indexName;
    const result = await this.client.send(cmd);
    return result.Items as Record<K, S[K]["_type"]>;
  }
}
