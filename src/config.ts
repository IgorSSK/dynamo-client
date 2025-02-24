import type { TranslateConfig } from "@aws-sdk/lib-dynamodb";
import {
  marshallWithDateConversion,
  unmarshallWithDateConversion,
} from "./utils";

export const translateConfig: TranslateConfig = {
  marshallOptions: {
    convertClassInstanceToMap: true,
    removeUndefinedValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
};

const processItem = (item: any) => marshallWithDateConversion(item);
const processItems = (items: any) => unmarshallWithDateConversion(items);

export const marshallMiddleware = (next) => async (args) => {
  const { input } = args;

  if (input.Item) {
    input.Item = processItem(input.Item);
  }
  if (input.ExpressionAttributeValues) {
    input.ExpressionAttributeValues = processItem(
      input.ExpressionAttributeValues
    );
  }

  const result = await next(args);
  const { output } = result;

  if (output.Item) {
    output.Item = processItems(output.Item);
  }
  if (output.Items) {
    output.Items = processItems(output.Items);
  }
  if (output.Attributes) {
    output.Attributes = processItems(output.Attributes);
  }

  return result;
};

export const marshallMiddlewareOptions = {
  step: "initialize",
  name: "dateConversionMiddleware",
  tags: ["DATE_CONVERSION"],
};
