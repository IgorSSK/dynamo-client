import { snakeCase } from "lodash";
import type { Attribute } from "./attribute";

/**
 * A map where keys are strings and values are Attribute instances.
 */
export type SchemaDefinition = Record<string, Attribute<any>>;

/**
 * Options that affect how the schema builder behaves.
 */
export interface SchemaOptions {
  transform?: {
    toSnakeCase?: boolean;
  };
}

export type SchemaItem<S extends SchemaDefinition> = {
  [K in keyof S]: S[K]["_type"];
};

/**
 * The DynamoSchema class is the entry point for configuring a table:
 * - It stores the table and region names.
 * - It accepts a schema definition.
 * - It returns a SchemaBuilder to later populate a concrete item.
 *
 * We use a generic so that after calling `.schema()`, the instance “remembers”
 * its schema shape.
 */
export class DynamoSchema<T extends SchemaDefinition> {
  private tableName: string;
  private regionName = "";
  private schemaDefinition!: T;
  private schemaOptions?: SchemaOptions;

  private constructor(name: string) {
    this.tableName = name;
  }

  /**
   * Create a new DynamoSchema instance.
   */
  public static table(name: string): DynamoSchema<any> {
    if (!name) throw new Error("Table name is required");
    return new DynamoSchema(name);
  }

  /**
   * Sets the AWS region.
   */
  public region(name: string): this {
    if (!name && process.env.AWS_REGION === undefined)
      throw new Error("Region name is required");

    this.regionName = name;
    return this;
  }

  /**
   * Defines the schema.
   */
  public schema<TDef extends SchemaDefinition>(
    definition: TDef,
    options?: SchemaOptions
  ): DynamoSchema<TDef> {
    this.schemaDefinition = definition as unknown as T;
    this.schemaOptions = options;
    return this as unknown as DynamoSchema<TDef>;
  }

  /**
   * Creates a new SchemaBuilder instance to “fill in” a concrete item.
   */
  // public createBuilder(): SchemaBuilder<T> {
  //   return new SchemaBuilder(this.schemaDefinition, this.schemaOptions);
  // }

  // public createQueryBuilder(): QueryBuilder<T> {
  //   return new QueryBuilder(this.schemaDefinition, this.schemaOptions);
  // }

  /**
   * Get the table name.
   */
  public getTable(): string {
    return this.tableName;
  }

  /**
   * Get the region name.
   */
  public getRegion(): string {
    return this.regionName;
  }

  /**
   * Get the schema definition.
   */
  public getSchema(): T {
    return this.schemaDefinition;
  }

  /**
   * Get the schema options.
   */
  public getSchemaOptions(): SchemaOptions | undefined {
    return this.schemaOptions;
  }

  public getAttributeName<K extends keyof T>(key: K): string {
    const field = this.schemaDefinition[key];
    let attrName = field?.attrName ?? (key as string);
    if (this.schemaOptions?.transform?.toSnakeCase) {
      attrName = snakeCase(attrName);
    }
    return attrName;
  }
}
