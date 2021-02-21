import {
  IntrospectionInputType,
  IntrospectionInputTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionOutputType,
  IntrospectionOutputTypeRef,
  IntrospectionTypeRef,
} from 'graphql'
import { JSONSchema4, JSONSchema4TypeName } from 'json-schema'
import { includes } from 'lodash'
import {
  isIntrospectionListTypeRef,
  isNonNullIntrospectionType,
} from './typeGuards'

export type GraphQLTypeNames = 'String' | 'Int' | 'Float' | 'Boolean'

export const typesMapping: { [k in GraphQLTypeNames]: JSONSchema4TypeName } = {
  Boolean: 'boolean',
  String: 'string',
  Int: 'number',
  Float: 'number',
}

// Convert a GraphQL Type to a valid JSON Schema type
export type GraphqlToJSONTypeArg =
  | IntrospectionTypeRef
  | IntrospectionInputTypeRef
  | IntrospectionOutputTypeRef
export const graphqlToJSONType = (k: GraphqlToJSONTypeArg): JSONSchema4 => {
  if (isIntrospectionListTypeRef(k)) {
    return {
      type: 'array',
      items: graphqlToJSONType(k.ofType),
    }
  } else if (isNonNullIntrospectionType(k)) {
    return graphqlToJSONType(k.ofType)
  } else {
    const name = (k as IntrospectionNamedTypeRef<
      IntrospectionInputType | IntrospectionOutputType
    >).name
    return includes(['OBJECT', 'INPUT_OBJECT', 'ENUM', 'SCALAR'], k.kind)
      ? includes(['OBJECT', 'INPUT_OBJECT', 'ENUM'], k.kind)
        ? { $ref: `#/definitions/${name}` }
        : // tslint:disable-next-line:no-any
          { type: (typesMapping as any)[name] }
      : { type: (typesMapping as any)[name] }
  }
}
