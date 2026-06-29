import {
  normalizeSearchKeyword,
  parsePaginationQuery
} from '../../../utils/query-parser.util'

describe('query-parser.util', () => {
  describe('parsePaginationQuery', () => {
    it('should clamp pageSize to a maximum of 100', () => {
      const result = parsePaginationQuery({
        pageSize: '100000',
        pageNumber: '2'
      })

      expect(result).toEqual({
        pageSize: 100,
        pageNumber: 2
      })
    })

    it('should clamp pageSize and pageNumber to minimum values', () => {
      const result = parsePaginationQuery({
        pageSize: '-10',
        pageNumber: '-2'
      })

      expect(result).toEqual({
        pageSize: 1,
        pageNumber: 1
      })
    })

    it('should use defaults for invalid pagination values', () => {
      const result = parsePaginationQuery(
        {
          pageSize: 'abc',
          pageNumber: 'def'
        },
        {
          pageSize: 50,
          pageNumber: 3
        }
      )

      expect(result).toEqual({
        pageSize: 50,
        pageNumber: 3
      })
    })
  })

  describe('normalizeSearchKeyword', () => {
    it('should trim and escape regex metacharacters', () => {
      expect(normalizeSearchKeyword('  .*coffee?  ')).toBe('\\.\\*coffee\\?')
    })

    it('should limit keyword length before regex use', () => {
      expect(normalizeSearchKeyword('a'.repeat(101))).toHaveLength(100)
    })

    it('should ignore empty keywords', () => {
      expect(normalizeSearchKeyword('   ')).toBeUndefined()
    })
  })
})
