import {
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionScalarType,
  IntrospectionType,
  IntrospectionInputType,
  IntrospectionNamedTypeRef,
  IntrospectionOutputType
} from 'graphql'
import { JSONSchema6 } from 'json-schema'
import { filter, map, MemoListIterator, reduce } from 'lodash'
import {
  isIntrospectionEnumType,
  isIntrospectionField,
  isIntrospectionInputObjectType,
  isIntrospectionInputValue,
  isIntrospectionListTypeRef,
  isIntrospectionObjectType,
  isNonNullIntrospectionType,
  isIntrospectionScalarType,
  isIntrospectionDefaultScalarType,
} from './typeGuards'
import { graphqlToJSONType, typesMapping } from './typesMapping'

export type JSONSchema6Acc = {
  [k: string]: JSONSchema6
}

type GetRequiredFieldsType = ReadonlyArray<
  IntrospectionInputValue | IntrospectionField
>
// Extract GraphQL no-nullable types
export const getRequiredFields = (fields: GetRequiredFieldsType) =>
  reduce(
    fields,
    (acc: string[], f) => {
      if (isNonNullIntrospectionType(f.type)) {
        acc.push(f.name)
      }
      return acc
    },
    []
  )

export type IntrospectionFieldReducerItem =
  | IntrospectionField
  | IntrospectionInputValue

// reducer for a types and inputs
export const introspectionFieldReducer: MemoListIterator<
  IntrospectionFieldReducerItem,
  JSONSchema6Acc,
  ReadonlyArray<IntrospectionFieldReducerItem>
> = (acc, curr: IntrospectionFieldReducerItem): JSONSchema6Acc => {
  if (isIntrospectionField(curr)) {
    const type = isNonNullIntrospectionType(curr.type)
      ? curr.type.ofType
      : curr.type

    if (isIntrospectionDefaultScalarType(type as IntrospectionScalarType)) {
      const name = (type as IntrospectionNamedTypeRef<
        IntrospectionInputType | IntrospectionOutputType
      >).name

      acc[curr.name] = {
        type: (typesMapping as any)[name]
      }
    } else {
      const returnType = graphqlToJSONType(type)

      acc[curr.name] = {
        type: 'object',
        properties: {
          return: returnType,
          arguments: {
            type: 'object',
            properties: reduce<IntrospectionFieldReducerItem, JSONSchema6Acc>(
              curr.args as IntrospectionFieldReducerItem[],
              introspectionFieldReducer,
              {}
            ),
            description:"1",
            required: getRequiredFields(curr.args),
          },
        },
        description:"2",
        required: [],
      }
    }
  } else if (isIntrospectionInputValue(curr)) {
    const returnType = isNonNullIntrospectionType(curr.type)
      ? graphqlToJSONType(curr.type.ofType)
      : graphqlToJSONType(curr.type)

    acc[curr.name] = returnType
    if (curr.defaultValue) {
      acc[curr.name].default = resolveDefaultValue(curr)
    }
  }

  acc[curr.name].description = curr.description || undefined
  return acc
}

// ENUM type defaults will not JSON.parse correctly, so if it is an ENUM then don't
// try to do that.
// TODO: fix typing here
export const resolveDefaultValue = (curr: any) => {
  return isIntrospectionEnumType(curr.type)
    ? curr.defaultValue
    : JSON.parse(curr.defaultValue)
}

// Reducer for each type exposed by the GraphQL Schema
export const introspectionTypeReducer: (
  type: 'definitions' | 'properties'
) => MemoListIterator<
  IntrospectionType,
  JSONSchema6Acc,
  IntrospectionType[]
> = (type) => (acc, curr: IntrospectionType): JSONSchema6Acc => {
  const isQueriesOrMutations = type === 'properties'

  if (isIntrospectionObjectType(curr)) {
    acc[curr.name] = {
      type: 'object',
      properties: reduce<IntrospectionFieldReducerItem, JSONSchema6Acc>(
        curr.fields as IntrospectionFieldReducerItem[],
        introspectionFieldReducer,
        {}
      ),
      // Query and Mutation are special Types, whose fields represent the individual
      // queries and mutations. None of them ought to not be considered required, even if
      // their return value is a NON_NULL one.
      required: isQueriesOrMutations ? [] : getRequiredFields(curr.fields),
    }
  } else if (isIntrospectionInputObjectType(curr)) {
    acc[curr.name] = {
      type: 'object',
      properties: reduce<IntrospectionFieldReducerItem, JSONSchema6Acc>(
        curr.inputFields as IntrospectionFieldReducerItem[],
        introspectionFieldReducer,
        {}
      ),
      required: getRequiredFields(curr.inputFields),
    }
  } else if (isIntrospectionEnumType(curr)) {
    acc[curr.name] = {
      type: 'string',
      anyOf: curr.enumValues.map((item) => {
        return {
          enum: [item.name],
          title: item.description || item.name,
          description: item.description || undefined,
        }
      }),
    }
  } else if (isIntrospectionDefaultScalarType(curr)) {
    acc[curr.name] = {
      type: (typesMapping as any)[curr.name],
      title: curr.name,
    }
  } else if (isIntrospectionScalarType(curr)) {
    acc[(curr as IntrospectionScalarType).name] = {
      type: 'object',
      title: (curr as IntrospectionScalarType).name,
    }
  }

  acc[curr.name].description = curr.description || undefined
  return acc
}
