import { IntrospectionQuery, IntrospectionType } from 'graphql'
import { JSONSchema4 } from 'json-schema'
import { includes, partition, reduce } from 'lodash'
import { introspectionTypeReducer, JSONSchema4Acc } from './reducer'
import { filterDefinitionsTypes, isIntrospectionObjectType } from './typeGuards'

// FIXME: finish this type
export interface GraphQLJSONSchema4 extends JSONSchema4 {
  properties: {
    Query: JSONSchema4Acc
    Mutation: JSONSchema4Acc
  }
  definitions: JSONSchema4Acc
}

export interface FromIntrospectionQueryOptions {
  ignoreInternals?: boolean // true by default
}
export const fromIntrospectionQuery = (
  introspection: IntrospectionQuery,
  opts?: FromIntrospectionQueryOptions
): JSONSchema4 => {
  const options = opts || { ignoreInternals: true }
  const { queryType, mutationType } = introspection.__schema

  if (mutationType) {
    const rootMutationType = (introspection.__schema.types as any).find(
      (t: any) => t.name == mutationType.name
    )
    if (rootMutationType) {
      ;(introspection.__schema.types as any).Mutation = rootMutationType
      ;(introspection.__schema.types as any).Mutation.name = 'Mutation'
    }
  }

  if (queryType) {
    const rootQueryType = (introspection.__schema.types as any).find(
      (t: any) => t.name == queryType.name
    )
    if (rootQueryType) {
      ;(introspection.__schema.types as any).Query = rootQueryType
      ;(introspection.__schema.types as any).Query.name = 'Query'
    }
  }
  //////////////////////////////////////////////////////////////////////
  //// Query and Mutation are properties, custom Types are definitions
  //////////////////////////////////////////////////////////////////////
  const [properties, definitions] = partition(
    introspection.__schema.types,
    (type) =>
      isIntrospectionObjectType(type) &&
      includes(['Query', 'Mutation'], type.name)
  )

  return {
    $schema: 'http://json-schema.org/draft-04/schema#',
    properties: reduce<IntrospectionType, JSONSchema4Acc>(
      properties,
      introspectionTypeReducer('properties'),
      {}
    ),
    definitions: reduce<IntrospectionType, JSONSchema4Acc>(
      filterDefinitionsTypes(definitions, options),
      introspectionTypeReducer('definitions'),
      {}
    ),
  }
}
