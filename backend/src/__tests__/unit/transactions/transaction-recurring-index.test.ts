import TransactionModel from '../../../models/transaction.model'

describe('recurring transaction identity', () => {
  it('enforces one child per recurring source and occurrence date', () => {
    const recurringIndex = TransactionModel.schema
      .indexes()
      .find(([fields]) => fields.recurringSourceId === 1 && fields.date === 1)

    expect(recurringIndex).toEqual([
      { recurringSourceId: 1, date: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          recurringSourceId: { $type: 'objectId' }
        }
      })
    ])
  })

  it('enforces one imported transaction per batch row', () => {
    const importIndex = TransactionModel.schema
      .indexes()
      .find(
        ([fields]) => fields.importBatchId === 1 && fields.importRowIndex === 1
      )

    expect(importIndex).toEqual([
      { importBatchId: 1, importRowIndex: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          importBatchId: { $type: 'objectId' },
          importRowIndex: { $type: 'number' }
        }
      })
    ])
  })
})
