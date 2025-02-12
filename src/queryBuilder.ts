// src/queryBuilder.ts

import type { QueryCommandInput } from "@aws-sdk/client-dynamodb";
import type { SchemaDefinition, SchemaOptions } from "./schema";

export class QueryBuilder<T extends SchemaDefinition> {
	private keyConditions: string[] = [];
	private attributeNames: Record<string, string> = {};
	private attributeValues: Record<string, any> = {};
	private input: Partial<QueryCommandInput> = {};
	private options: SchemaOptions;

	constructor(private schema: T, options?: SchemaOptions) {
		this.options = options || {};
	}

	/**
	 * Factory method to create a new QueryBuilder instance with a schema definition.
	 */
	// public static create<T extends SchemaDefinition>(
	// 	schema: T,
	// 	options?: { transformToSnakeCase?: boolean }
	// ): QueryBuilder<T> {
	// 	return new QueryBuilder(schema, options);
	// }

	/**
	 * Converts a camelCase key to snake_case.
	 */
	private toSnakeCase(key: string): string {
		return key.replace(/([A-Z])/g, "_$1").toLowerCase();
	}

	/**
	 * Retrieves the attribute name for the given schema key.
	 */
	private getAttributeName<K extends keyof T>(key: K): string {
		const field = this.schema[key];
		let attrName = field?.attrName ?? (key as string);
		if (this.options?.transform?.toSnakeCase) {
			attrName = this.toSnakeCase(attrName);
		}
		return attrName;
	}

	/**
	 * Sets a partition key equality condition using a schema definition key.
	 */
	public keys<K extends keyof T>(k: K, value: T[K]["_type"]): this {
		for (const key in {k, value}) {
			const attrName = this.getAttributeName(key);
			const namePlaceholder = `#${attrName}`;
			const valuePlaceholder = `:${attrName}`;
			this.keyConditions.push(`${namePlaceholder} = ${valuePlaceholder}`);
			this.attributeNames[namePlaceholder] = attrName;
			this.attributeValues[valuePlaceholder] = { S: key };
		}
		return this;
	}

	/**
	 * Adds an attribute_exists condition using a schema definition key.
	 */
	public attributeExists<K extends keyof T>(key: K): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		this.keyConditions.push(`attribute_exists(${namePlaceholder})`);
		this.attributeNames[namePlaceholder] = attrName;
		return this;
	}

	/**
	 * Adds an attribute_not_exists condition using a schema definition key.
	 */
	public attributeNotExists<K extends keyof T>(key: K): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		this.keyConditions.push(`attribute_not_exists(${namePlaceholder})`);
		this.attributeNames[namePlaceholder] = attrName;
		return this;
	}

	/**
	 * Adds an attribute_type condition using a schema definition key.
	 */
	public attributeType<K extends keyof T>(key: K, type: string): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		const valuePlaceholder = `:${attrName}_type`;
		this.keyConditions.push(`attribute_type(${namePlaceholder}, ${valuePlaceholder})`);
		this.attributeNames[namePlaceholder] = attrName;
		this.attributeValues[valuePlaceholder] = { S: type };
		return this;
	}

	/**
	 * Adds a contains condition using a schema definition key.
	 */
	public contains<K extends keyof T>(key: K, operand: string): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		const valuePlaceholder = `:${attrName}_contains`;
		this.keyConditions.push(`contains(${namePlaceholder}, ${valuePlaceholder})`);
		this.attributeNames[namePlaceholder] = attrName;
		this.attributeValues[valuePlaceholder] = { S: operand };
		return this;
	}

	/**
	 * Adds a begins_with condition using a schema definition key.
	 */
	public beginsWith<K extends keyof T>(key: K, prefix: string): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		const valuePlaceholder = `:${attrName}_begins`;
		this.keyConditions.push(`begins_with(${namePlaceholder}, ${valuePlaceholder})`);
		this.attributeNames[namePlaceholder] = attrName;
		this.attributeValues[valuePlaceholder] = { S: prefix };
		return this;
	}

	/**
	 * Adds a size condition using a schema definition key.
	 */
	public size<K extends keyof T>(key: K, operator: string, value: number): this {
		const attrName = this.getAttributeName(key);
		const namePlaceholder = `#${attrName}`;
		const valuePlaceholder = `:${attrName}_size`;
		this.keyConditions.push(`size(${namePlaceholder}) ${operator} ${valuePlaceholder}`);
		this.attributeNames[namePlaceholder] = attrName;
		this.attributeValues[valuePlaceholder] = { N: value.toString() };
		return this;
	}

	/** Sets the maximum number of items to evaluate. */
	public limit(limit: number): this {
		this.input.Limit = limit;
		return this;
	}

	/** Sets the index name if querying a secondary index. */
	public indexName(indexName: string): this {
		this.input.IndexName = indexName;
		return this;
	}

	/**
	 * Finalizes and returns the QueryCommandInput.
	 */
	public build(): QueryCommandInput {
		if (this.keyConditions.length > 0) {
			this.input.KeyConditionExpression = this.keyConditions.join(" and ");
		}
		if (Object.keys(this.attributeNames).length > 0) {
			this.input.ExpressionAttributeNames = this.attributeNames;
		}
		if (Object.keys(this.attributeValues).length > 0) {
			this.input.ExpressionAttributeValues = this.attributeValues;
		}
		return this.input as QueryCommandInput;
	}
}
