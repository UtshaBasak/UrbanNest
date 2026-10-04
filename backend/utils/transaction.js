import mongoose from 'mongoose';

let supportsTransactions;

// Transactions need a replica set or sharded cluster (e.g. MongoDB Atlas).
// A standalone local mongod rejects them, so detect that once and fall back.
const detectTransactionSupport = async () => {
  if (supportsTransactions === undefined) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      supportsTransactions = Boolean(hello.setName) || hello.msg === 'isdbgrid';
    } catch {
      supportsTransactions = false;
    }
    if (!supportsTransactions) {
      console.warn('MongoDB is not a replica set: multi-document deletes will run without a transaction.');
    }
  }
  return supportsTransactions;
};

// Run work(session) inside a transaction when available; otherwise with session = null.
export const runInTransaction = async (work) => {
  if (!(await detectTransactionSupport())) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    session.endSession();
  }
};
