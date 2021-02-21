import ajv from 'ajv'
import { JSONSchema4 } from 'json-schema'
import { fromIntrospectionQuery } from '../lib/fromIntrospectionQuery'
import {
  getTodoSchemaIntrospection,
  todoSchemaAsJsonSchema,
} from '../test-utils'

describe('GraphQL to JSON Schema', () => {
  const { introspection } = getTodoSchemaIntrospection()

  test('from IntrospectionQuery object', () => {
    const result = fromIntrospectionQuery(introspection)
    expect(result).toMatchObject(<JSONSchema4>todoSchemaAsJsonSchema)
    const validator = new ajv()
    validator.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'))
    expect(validator.validateSchema(result)).toBe(true)
  })
})
