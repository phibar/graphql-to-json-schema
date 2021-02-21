import {
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionScalarType,
  IntrospectionType,
  IntrospectionInputType,
  IntrospectionNamedTypeRef,
  IntrospectionOutputType,
} from 'graphql'
import { JSONSchema4 } from 'json-schema'
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

export type JSONSchema4Acc = {
  [k: string]: JSONSchema4
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
  JSONSchema4Acc,
  ReadonlyArray<IntrospectionFieldReducerItem>
> = (acc, curr: IntrospectionFieldReducerItem): JSONSchema4Acc => {
  if (isIntrospectionField(curr)) {
    const type = isNonNullIntrospectionType(curr.type)
      ? curr.type.ofType
      : curr.type

    if (isIntrospectionDefaultScalarType(type as IntrospectionScalarType)) {
      const name = (type as IntrospectionNamedTypeRef<
        IntrospectionInputType | IntrospectionOutputType
      >).name

      acc[curr.name] = {
        type: (typesMapping as any)[name],
      }
    } else {
      const returnType = graphqlToJSONType(type)

      const props: JSONSchema4 = {
        return: returnType,
        arguments: {
          type: 'object',
          properties: reduce<IntrospectionFieldReducerItem, JSONSchema4Acc>(
            curr.args as IntrospectionFieldReducerItem[],
            introspectionFieldReducer,
            {}
          ),
        },
      }
      if (getRequiredFields(curr.args).length)
        props.arguments.required = getRequiredFields(curr.args)
      acc[curr.name] = {
        type: 'object',
        properties: props,
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
  JSONSchema4Acc,
  IntrospectionType[]
> = (type) => (acc, curr: IntrospectionType): JSONSchema4Acc => {
  const isQueriesOrMutations = type === 'properties'

  if (isIntrospectionObjectType(curr)) {
    acc[curr.name] = {
      type: 'object',
      properties: reduce<IntrospectionFieldReducerItem, JSONSchema4Acc>(
        curr.fields as IntrospectionFieldReducerItem[],
        introspectionFieldReducer,
        {}
      ),
    }
    if (!isQueriesOrMutations && getRequiredFields(curr.fields).length)
      acc[curr.name].required = getRequiredFields(curr.fields)
  } else if (isIntrospectionInputObjectType(curr)) {
    acc[curr.name] = {
      type: 'object',
      properties: reduce<IntrospectionFieldReducerItem, JSONSchema4Acc>(
        curr.inputFields as IntrospectionFieldReducerItem[],
        introspectionFieldReducer,
        {}
      ),
    }
    if (getRequiredFields(curr.inputFields).length)
      acc[curr.name].required = getRequiredFields(curr.inputFields)
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
